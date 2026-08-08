import { HTML_PREVIEW_GRAPHVIZ_RENDER_RESPONSE_EVENT, HTML_PREVIEW_MESSAGE_CHANNEL } from './previewMessageProtocol';

/**
 * Lightweight completeness heuristic for streaming DOT: balanced parens /
 * brackets / braces and closed quotes. Incomplete mid-stream DOT stays
 * "pending" and is re-evaluated on the next mutation instead of posting a
 * request that is guaranteed to fail. Kept as a plain module-level function so
 * it can be unit-tested and embedded into the iframe script via .toString().
 */
export const isProbablyCompleteDot = (dot: string): boolean => {
  if (!dot || !dot.trim()) return false;
  let parens = 0;
  let brackets = 0;
  let braces = 0;
  let inDoubleQuote = false;
  for (let i = 0; i < dot.length; i += 1) {
    const ch = dot[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '"') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (inDoubleQuote) continue;
    if (ch === '(') parens += 1;
    else if (ch === ')') parens -= 1;
    else if (ch === '[') brackets += 1;
    else if (ch === ']') brackets -= 1;
    else if (ch === '{') braces += 1;
    else if (ch === '}') braces -= 1;
  }
  return parens === 0 && brackets === 0 && braces === 0 && !inDoubleQuote;
};

/**
 * Declarative graphviz renderer injected into Live Artifacts.
 *
 * The model emits `<div data-amc-graphviz='digraph {...}'></div>` nodes; this
 * script detects them and asks the parent page to lay out the DOT (viz.js is
 * WASM and cannot run inside the opaque sandbox origin). The parent replies
 * through the preview bridge with sanitized SVG, which this script re-checks and
 * injects. State is tracked with `data-amc-graphviz-sig` (content hash, so the
 * MutationObserver never re-renders its own output) and
 * `data-amc-graphviz-state` (`pending` / `rendered` / `error`).
 *
 * Defense-in-depth: the parent's reply is validated (`event.source ===
 * window.parent` + channel + pending id + sig) and the SVG is re-sanitized here
 * before injection, so even a compromised parent reply cannot execute handlers
 * inside the artifact.
 *
 * The script is a self-contained IIFE so it also runs standalone via
 * `new Function` in tests and in the unrestricted code-block preview. It relies
 * on the bridge-scope `notifyDiagnostic` binding only when present.
 */
export const GRAPHVIZ_RENDERER_SCRIPT = `
(() => {
  const ATTR = 'data-amc-graphviz';
  const SIG_ATTR = 'data-amc-graphviz-sig';
  const STATE_ATTR = 'data-amc-graphviz-state';
  const channel = ${JSON.stringify(HTML_PREVIEW_MESSAGE_CHANNEL)};
  const responseEvent = ${JSON.stringify(HTML_PREVIEW_GRAPHVIZ_RENDER_RESPONSE_EVENT)};
  const parentWindow = window.parent;

  const hash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  const isProbablyCompleteDot = ${isProbablyCompleteDot.toString()};

  const setState = (node, state) => {
    if (state) node.setAttribute(STATE_ATTR, state);
    else node.removeAttribute(STATE_ATTR);
  };

  // Defense-in-depth re-sanitization before injection. The parent already
  // DOMPurify'd the SVG, but if the parent were ever bypassed, this guarantees
  // no script/iframe tags, no event handlers, and no non-https links survive.
  const lightSanitizeSvg = (svgString) => {
    try {
      const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
      const root = doc.documentElement;
      if (root.querySelector('parsererror')) return null;
      root.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
      const elements = [root, ...Array.from(root.querySelectorAll('*'))];
      elements.forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            el.removeAttribute(attr.name);
            return;
          }
          if (
            (name === 'href' || name === 'xlink:href') &&
            attr.value &&
            !/^https:/i.test(attr.value.trim())
          ) {
            el.removeAttribute(attr.name);
          }
        });
      });
      return root;
    } catch {
      return null;
    }
  };

  const showFallback = (node, dot, message) => {
    setState(node, 'error');
    node.replaceChildren();
    const pre = document.createElement('pre');
    pre.style.cssText =
      'border:1px dashed var(--amc-live-artifact-border);color:var(--amc-live-artifact-muted);' +
      'font:0.75em monospace;padding:0.5rem;white-space:pre-wrap;overflow-x:auto;margin:0;';
    pre.textContent = dot;
    node.appendChild(pre);
    if (typeof notifyDiagnostic === 'function') {
      notifyDiagnostic({ type: 'graphviz-error', message, snippet: dot.slice(0, 200) });
    }
  };

  const ERROR_MESSAGES = {
    empty: 'Empty DOT',
    'too-large': 'DOT exceeds limits',
    'render-failed': 'Graphviz render failed',
  };

  const pendingById = new Map();
  let requestSeq = 0;
  const MAX_PENDING = 64;

  const requestRender = (node) => {
    const dot = node.getAttribute(ATTR) || '';
    if (!dot) {
      showFallback(node, dot, 'Missing DOT source');
      return;
    }
    const sig = hash(dot);
    if (node.getAttribute(SIG_ATTR) === sig) return;

    if (!isProbablyCompleteDot(dot)) {
      setState(node, 'pending');
      return;
    }

    const id = 'amc-gv-' + String(++requestSeq);
    pendingById.set(id, { node, sig });
    if (pendingById.size > MAX_PENDING) {
      const oldestId = pendingById.keys().next().value;
      if (oldestId !== undefined) pendingById.delete(oldestId);
    }

    node.setAttribute(SIG_ATTR, sig);
    setState(node, 'pending');

    if (parentWindow && typeof parentWindow.postMessage === 'function') {
      parentWindow.postMessage({ channel, event: 'graphviz-render-request', payload: { id, dot } }, '*');
    }  };

  const handleRenderResponse = (data) => {
    const payload = data.payload;
    if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string') return;
    const entry = pendingById.get(payload.id);
    if (!entry) return;
    pendingById.delete(payload.id);

    const node = entry.node;
    if (!node || !node.isConnected) return;

    // The stream may have advanced while the render was in flight: drop the
    // stale response so an older layout never replaces newer content.
    const currentDot = node.getAttribute(ATTR) || '';
    if (hash(currentDot) !== entry.sig) return;

    if (payload.ok && typeof payload.svg === 'string') {
      const svgRoot = lightSanitizeSvg(payload.svg);
      if (!svgRoot) {
        showFallback(node, currentDot, 'Invalid SVG response');
        return;
      }
      node.replaceChildren(svgRoot);
      setState(node, 'rendered');
      return;
    }

    const error = typeof payload.error === 'string' ? payload.error : 'render-failed';
    showFallback(node, currentDot, ERROR_MESSAGES[error] || 'Graphviz render failed');
  };

  function renderAll() {
    document.querySelectorAll('[' + ATTR + ']').forEach(requestRender);
  }

  let frame = 0;
  const scheduleScan = () => {
    if (frame) return;
    frame = (window.requestAnimationFrame || ((fn) => fn()))(() => {
      frame = 0;
      renderAll();
    });
  };

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.channel !== channel || event.data.event !== responseEvent) {
      return;
    }
    // Only accept replies from the parent page — a demo script inside the
    // iframe self-posting a forged response must be ignored.
    if (event.source !== window.parent) return;
    handleRenderResponse(event.data);
  });

  renderAll();
  if (window.MutationObserver && parentWindow) {
    new MutationObserver(scheduleScan).observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [ATTR],
    });
  }

  window.__amcGraphviz = { renderAll };
})();
`;
