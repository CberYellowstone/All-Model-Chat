import { describe, expect, it } from 'vitest';
import { isProbablyCompleteDot, GRAPHVIZ_RENDERER_SCRIPT } from './graphvizRendererScript';

type GraphvizApi = { renderAll: () => void };

describe('isProbablyCompleteDot', () => {
  it('accepts a complete digraph', () => {
    expect(isProbablyCompleteDot('digraph { A -> B }')).toBe(true);
  });

  it('accepts a multi-line dot with quoted labels', () => {
    const dot = `digraph {
      A[label="parse request"];
      B[label="return result"];
      A -> B;
    }`;
    expect(isProbablyCompleteDot(dot)).toBe(true);
  });

  it('rejects an unclosed opening brace', () => {
    expect(isProbablyCompleteDot('digraph { A -> B')).toBe(false);
  });

  it('rejects an unclosed double quote inside a label', () => {
    expect(isProbablyCompleteDot('digraph { A[label="x] }')).toBe(false);
  });

  it('ignores braces/operators inside a quoted label', () => {
    // The `{` and `->` inside the quoted label must not unbalance the scan.
    expect(isProbablyCompleteDot('digraph { A[label="a { b -> c"] }')).toBe(true);
  });

  it('rejects an unbalanced bracket (node attribute)', () => {
    expect(isProbablyCompleteDot('digraph { A[shape=box }')).toBe(false);
  });

  it('rejects empty / whitespace-only input', () => {
    expect(isProbablyCompleteDot('')).toBe(false);
    expect(isProbablyCompleteDot('   ')).toBe(false);
  });
});

const createGraphvizDoc = (dot: string): Document => {
  const doc = new DOMParser().parseFromString('<!DOCTYPE html><html><body></body></html>', 'text/html');
  const div = doc.createElement('div');
  div.setAttribute('data-amc-graphviz', dot);
  doc.body.appendChild(div);
  return doc;
};

/**
 * Runs the renderer against a detached jsdom document via the same `new
 * Function` bridge the export path uses. A stub `window.parent` records posted
 * render requests so tests can simulate a parent reply, and the window message
 * listener is exposed so tests can dispatch replies from any source (including
 * a forged self-post).
 */
const runRenderer = (
  doc: Document,
): {
  api: GraphvizApi;
  requests: Array<{ id: string; dot: string }>;
  dispatch: (payload: unknown, source?: unknown) => void;
} => {
  const requests: Array<{ id: string; dot: string }> = [];
  let messageListener: ((event: { data: unknown; source: unknown }) => void) | null = null;

  const parentStub = {
    postMessage: (message: { event: string; payload: { id: string; dot: string } }) => {
      requests.push(message.payload);
    },
  };

  const stubWindow: Record<string, unknown> = {
    document: doc,
    MutationObserver: undefined,
    requestAnimationFrame: (fn: () => void) => fn(),
    addEventListener: (_type: string, listener: unknown) => {
      messageListener = listener as (event: { data: unknown; source: unknown }) => void;
    },
    navigator: {},
    location: { origin: 'null' },
    parent: parentStub,
  };

  const run = new Function('window', 'document', GRAPHVIZ_RENDERER_SCRIPT);
  run(stubWindow, doc);

  return {
    api: (stubWindow as unknown as { __amcGraphviz: GraphvizApi }).__amcGraphviz,
    requests,
    dispatch: (payload, source = parentStub) => {
      messageListener?.({
        data: { channel: 'amc-webui-html-preview', event: 'graphviz-render-response', payload },
        source,
      });
    },
  };
};

describe('GRAPHVIZ_RENDERER_SCRIPT', () => {
  it('posts a render request for a complete dot and injects the SVG reply', () => {
    const doc = createGraphvizDoc('digraph { A -> B }');
    const { requests, dispatch } = runRenderer(doc);

    const node = doc.querySelector('[data-amc-graphviz]')!;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.dot).toBe('digraph { A -> B }');
    expect(node.getAttribute('data-amc-graphviz-state')).toBe('pending');

    dispatch({
      id: requests[0]!.id,
      ok: true,
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
    });

    expect(node.getAttribute('data-amc-graphviz-state')).toBe('rendered');
    expect(node.querySelector('svg')).not.toBeNull();
  });

  it('keeps an incomplete streaming dot pending without posting a request', () => {
    const doc = createGraphvizDoc('digraph { A ->');
    const { requests } = runRenderer(doc);

    const node = doc.querySelector('[data-amc-graphviz]')!;
    expect(requests).toHaveLength(0);
    expect(node.getAttribute('data-amc-graphviz-state')).toBe('pending');
  });

  it('renders once an incomplete dot becomes complete', () => {
    const doc = createGraphvizDoc('digraph { A ->');
    const { api, requests } = runRenderer(doc);
    expect(requests).toHaveLength(0);

    const node = doc.querySelector('[data-amc-graphviz]')!;
    node.setAttribute('data-amc-graphviz', 'digraph { A -> B }');
    api.renderAll();

    expect(requests).toHaveLength(1);
    expect(requests[0]!.dot).toBe('digraph { A -> B }');
  });

  it('shows the dot source as fallback and reports a diagnostic on render failure', () => {
    const doc = createGraphvizDoc('digraph { A -> B }');
    const { requests, dispatch } = runRenderer(doc);

    const node = doc.querySelector('[data-amc-graphviz]')!;
    dispatch({ id: requests[0]!.id, ok: false, error: 'too-large' });

    expect(node.getAttribute('data-amc-graphviz-state')).toBe('error');
    expect(node.textContent).toContain('digraph { A -> B }');
  });

  it('rejects a forged response from a non-parent source', () => {
    const doc = createGraphvizDoc('digraph { A -> B }');
    const { requests, dispatch } = runRenderer(doc);

    const node = doc.querySelector('[data-amc-graphviz]')!;
    // The node's sig is only set after the request is posted, so it is present.
    dispatch(
      { id: requests[0]!.id, ok: true, svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' },
      { postMessage: () => {} }, // a self-posted message: source !== window.parent
    );

    // A forged reply must not inject anything.
    expect(node.querySelector('svg')).toBeNull();
    expect(node.getAttribute('data-amc-graphviz-state')).toBe('pending');
  });

  it('drops a stale response when the dot advanced while the render was in flight', () => {
    const doc = createGraphvizDoc('digraph { A -> B }');
    const { requests, dispatch } = runRenderer(doc);

    const node = doc.querySelector('[data-amc-graphviz]')!;
    // Stream advances to a new dot while the request is pending.
    node.setAttribute('data-amc-graphviz', 'digraph { A -> C }');

    dispatch({ id: requests[0]!.id, ok: true, svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' });

    // The stale response must not inject an SVG for the old dot.
    expect(node.querySelector('svg')).toBeNull();
  });

  it('skips re-requesting a node whose sig already matches (self-render guard)', () => {
    const doc = createGraphvizDoc('digraph { A -> B }');
    const { api, requests } = runRenderer(doc);
    expect(requests).toHaveLength(1);

    // A mutation observer scan re-runs renderAll; the sig is unchanged so no
    // second request and no state churn.
    api.renderAll();
    expect(requests).toHaveLength(1);
  });
});
