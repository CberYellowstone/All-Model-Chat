import DOMPurify from 'dompurify';
import { logService } from '@/services/logService';
import { AVAILABLE_THEMES, DEFAULT_THEME_ID } from '@/constants/themeRegistry';
import type { Theme } from '@/types/theme';

/**
 * Shared Graphviz (viz-js) runtime used by three render paths so they all lay
 * out the same DOT through one cache and one sanitizer:
 *
 *  1. `GraphvizBlock` — the ```graphviz``` code-block renderer (lazy layout
 *     toggle, JPG export, side panel).
 *  2. Live Artifacts `data-amc-graphviz` nodes — the sandboxed iframe asks the
 *     parent page to render (viz.js is WASM and cannot run inside the opaque
 *     origin), and the parent replies through the preview bridge.
 *  3. PNG export hydration — the same runtime renders static SVG into the
 *     export snapshot so the exported transcript matches the on-screen bubble.
 *
 * `loadVizInstance` keeps the dynamic `@viz-js/viz` import (and its ~MB WASM
 * chunk) lazy: it is only fetched the first time a diagram actually renders.
 */

export const DOT_MAX_CHARS = 16_000;
export const DOT_MAX_EDGES = 200;

export type DotRenderResult =
  | { ok: true; svg: string }
  | { ok: false; error: 'empty' | 'too-large'; message?: never }
  | { ok: false; error: 'render-failed'; message: string };

interface DotRenderOptions {
  themeId?: string;
  /**
   * Forced layout. When omitted the DOT's own rankdir wins; when no rankdir is
   * present it defaults to LR (the Live Artifacts DSL default). GraphvizBlock
   * passes the user's manual LR/TB toggle here.
   */
  layout?: 'LR' | 'TB';
}

type VizInstance = {
  renderSVGElement: (code: string) => SVGSVGElement | Promise<SVGSVGElement>;
};

let vizInstancePromise: Promise<VizInstance> | null = null;

export const getVizInstance = async (): Promise<VizInstance> => {
  if (!vizInstancePromise) {
    vizInstancePromise = import('@viz-js/viz')
      .then(({ instance }) => instance())
      .catch((error) => {
        vizInstancePromise = null;
        throw error;
      });
  }
  return vizInstancePromise;
};

const GRAPHVIZ_CACHE_LIMIT = 64;
const graphvizCache = new Map<string, string>();

// LRU eviction: Map preserves insertion order, so deleting the oldest entry
// before re-inserting on access keeps the cache bounded.
const touchGraphvizCache = (key: string, value: string) => {
  graphvizCache.delete(key);
  graphvizCache.set(key, value);
  while (graphvizCache.size > GRAPHVIZ_CACHE_LIMIT) {
    const oldestKey = graphvizCache.keys().next().value;
    if (oldestKey === undefined) break;
    graphvizCache.delete(oldestKey);
  }
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
};

const THEME_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const resolveGraphvizTheme = (themeId?: string): Theme => {
  if (themeId && THEME_ID_PATTERN.test(themeId)) {
    const theme = AVAILABLE_THEMES.find((candidate) => candidate.id === themeId);
    if (theme) return theme;
  }
  return AVAILABLE_THEMES.find((candidate) => candidate.id === DEFAULT_THEME_ID) ?? AVAILABLE_THEMES[0];
};

/**
 * Derives the effective layout from a DOT string the same way GraphvizBlock
 * did: an explicit rankdir wins, otherwise LR. Exposed so the cache key and the
 * actual render always agree even when `layout` was not passed explicitly.
 */
export const resolveDotLayout = (dot: string, forced?: 'LR' | 'TB'): 'LR' | 'TB' => {
  if (forced === 'LR' || forced === 'TB') return forced;
  const match = dot.match(/rankdir\s*=\s*(["']?)(LR|TB|RL|BT)\1/i);
  if (match) {
    const dir = match[2].toUpperCase();
    if (dir === 'TB' || dir === 'BT') return 'TB';
    return 'LR';
  }
  return 'LR';
};

export const getGraphvizCacheKey = (dot: string, options: DotRenderOptions = {}): string => {
  const layout = resolveDotLayout(dot, options.layout);
  return `${options.themeId ?? ''}:${layout}:${hashString(dot)}`;
};

// Semantic color names allowed by the Live Artifacts graphviz DSL. Each maps to
// the theme's concrete color — the same values `buildPreviewThemeStyle` emits as
// `--amc-live-artifact-*` tokens, so a data-amc-graphviz diagram and a
// data-amc-chart beside it resolve to identical colors on every theme.
const SEMANTIC_COLOR_ATTRS = ['color', 'fontcolor', 'fillcolor', 'bgcolor', 'bordercolor'];
const SEMANTIC_COLOR_NAMES = ['accent', 'success', 'warning', 'danger', 'muted', 'subtle'];
const SEMANTIC_COLOR_MAP: Record<string, keyof Theme['colors']> = {
  accent: 'textLink',
  success: 'textSuccess',
  warning: 'textWarning',
  danger: 'textDanger',
  muted: 'textSecondary',
  subtle: 'textTertiary',
};

const applyThemeAndLayout = (dot: string, options: DotRenderOptions): string => {
  let code = dot;
  const layout = resolveDotLayout(code, options.layout);
  const colors = resolveGraphvizTheme(options.themeId).colors;

  // Layout: rewrite an explicit rankdir, or inject the default right after the
  // graph-opening declaration so it wins over any node/edge defaults below.
  const rankdirRegex = /(rankdir\s*=\s*)(["']?)(LR|TB|RL|BT)\2/gi;
  if (rankdirRegex.test(code)) {
    code = code.replace(rankdirRegex, `$1"${layout}"`);
  } else {
    const graphMatch = code.match(/(\s*(?:di)?graph\s+[\w\d_"]*\s*\{)/i);
    if (graphMatch) {
      code = code.replace(graphMatch[0], `${graphMatch[0]}\n  rankdir="${layout}";`);
    }
  }

  // Semantic color names → theme values. The regex is anchored to a known
  // color attribute so `label="accent"` prose is never rewritten.
  const semanticColorPattern = new RegExp(
    `\\b(${SEMANTIC_COLOR_ATTRS.join('|')})\\s*=\\s*["']?(${SEMANTIC_COLOR_NAMES.join('|')})["']?`,
    'gi',
  );
  code = code.replace(semanticColorPattern, (_match, attr: string, name: string) => {
    const colorKey = SEMANTIC_COLOR_MAP[name.toLowerCase()] ?? 'textPrimary';
    return `${attr}="${colors[colorKey]}"`;
  });

  // Theme defaults mirror the Live Artifacts surface: transparent background,
  // primary-color text, secondary-color strokes for nodes and edges.
  const themeDefaults = `
    graph [bgcolor="transparent" fontcolor="${colors.textPrimary}" fontname="system-ui, sans-serif" margin="0"];
    node [color="${colors.textSecondary}" fontcolor="${colors.textPrimary}"];
    edge [color="${colors.textSecondary}" fontcolor="${colors.textPrimary}"];
  `;

  const openBraceIndex = code.indexOf('{');
  if (openBraceIndex !== -1) {
    code = code.slice(0, openBraceIndex + 1) + themeDefaults + code.slice(openBraceIndex + 1);
  }

  return code;
};

const sanitizeSvg = (svg: string): string => {
  // viz output is not trusted (HTML-like labels can carry event handlers), so
  // sanitize with the SVG profile and strip on* / non-https hrefs. The hook is
  // scoped to this call and removed afterwards so other sanitizers (Mermaid)
  // keep the default behavior.
  const stripDangerousAttributes = (
    _node: Element,
    data: { attrName: string; attrValue: string; keepAttr: boolean },
  ) => {
    if (data.attrName.startsWith('on')) {
      data.keepAttr = false;
      return;
    }
    if (
      (data.attrName === 'href' || data.attrName === 'xlink:href') &&
      data.attrValue &&
      !/^https:/i.test(data.attrValue.trim())
    ) {
      data.keepAttr = false;
    }
  };
  DOMPurify.addHook('uponSanitizeAttribute', stripDangerousAttributes);
  try {
    return DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'a'],
    });
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', stripDangerousAttributes);
  }
};

const countEdges = (dot: string): number => {
  const matches = dot.match(/->|--/g);
  return matches ? matches.length : 0;
};

/**
 * Renders DOT to a sanitized SVG string. Never throws for invalid input — the
 * result carries a machine-readable error so the Live Artifacts bridge can show
 * the DOT source as a fallback and the export path can skip the node.
 */
export const renderDotToSvg = async (dot: string, options: DotRenderOptions = {}): Promise<DotRenderResult> => {
  const code = dot.trim();
  if (!code) {
    return { ok: false, error: 'empty' };
  }
  if (code.length > DOT_MAX_CHARS || countEdges(code) > DOT_MAX_EDGES) {
    return { ok: false, error: 'too-large' };
  }

  try {
    const vizInstance = await getVizInstance();
    const processedCode = applyThemeAndLayout(code, options);
    const svgElement = await vizInstance.renderSVGElement(processedCode);

    // Preserve intrinsic SVG dimensions so flex layouts do not collapse the diagram.
    svgElement.style.maxWidth = '100%';
    svgElement.style.height = 'auto';
    svgElement.style.display = 'block';

    return { ok: true, svg: sanitizeSvg(svgElement.outerHTML) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Graphviz render failed';
    logService.error('Failed to render Graphviz diagram', error);
    return { ok: false, error: 'render-failed', message };
  }
};

/**
 * Cached twin of `renderDotToSvg`, shared by the Live Artifacts bridge and the
 * export path. The cache key includes theme + layout, so a diagram rendered for
 * one theme never leaks a stale color into another theme's snapshot.
 */
export const renderDotToSvgCached = async (dot: string, options: DotRenderOptions = {}): Promise<DotRenderResult> => {
  const key = getGraphvizCacheKey(dot, options);
  const cached = graphvizCache.get(key);
  if (cached !== undefined) {
    touchGraphvizCache(key, cached);
    return { ok: true, svg: cached };
  }

  const result = await renderDotToSvg(dot, {
    ...options,
    layout: resolveDotLayout(dot, options.layout),
  });
  if (result.ok) {
    touchGraphvizCache(key, result.svg);
  }
  return result;
};

/**
 * Hydrates every `data-amc-graphviz` node in a detached document (the PNG-export
 * snapshot) as static SVG. Failures leave the node untouched so the export never
 * breaks on a bad diagram — it just shows the inert placeholder.
 */
export const hydrateGraphvizIntoDocument = async (doc: Document, options: DotRenderOptions = {}): Promise<void> => {
  const nodes = Array.from(doc.querySelectorAll('[data-amc-graphviz]'));
  if (nodes.length === 0) {
    return;
  }

  await Promise.all(
    nodes.map(async (node) => {
      const dot = node.getAttribute('data-amc-graphviz') ?? '';
      const result = await renderDotToSvgCached(dot, options);
      if (!result.ok) return;

      try {
        const parsed = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        if (parsed.querySelector('parsererror')) return;
        node.replaceChildren(parsed.documentElement);
      } catch {
        // Leave the node as-is; it stays an inert placeholder in the snapshot.
      }
    }),
  );
};
