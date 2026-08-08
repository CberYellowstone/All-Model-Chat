import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DOT_MAX_CHARS, DOT_MAX_EDGES } from './graphvizLimits';
import {
  getGraphvizCacheKey,
  renderDotToSvg,
  renderDotToSvgCached,
  resolveDotLayout,
  hydrateGraphvizIntoDocument,
} from './vizRuntime';

// Provide a fake viz runtime so no WASM is fetched in tests. The returned SVG
// records the processed DOT in a data-code attribute, letting tests assert on
// theme injection / layout rewriting without real layout.
const fakeInstance = {
  renderSVGElement: vi.fn(async (code: string) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('data-code', code);
    return svg;
  }),
};

vi.mock('@viz-js/viz', () => ({
  instance: vi.fn(async () => fakeInstance),
}));

beforeEach(() => {
  fakeInstance.renderSVGElement.mockClear();
});

// The fake viz stores the processed DOT in a data-code attribute; outerHTML
// serialization HTML-escapes the inner double quotes, so decode via DOMParser
// before asserting on the theme injection / layout rewriting.
const readProcessedCode = (svgString: string): string => {
  const parsed = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  return parsed.documentElement.getAttribute('data-code') ?? '';
};

describe('resolveDotLayout', () => {
  it('defaults to LR when no rankdir present', () => {
    expect(resolveDotLayout('digraph { A -> B }')).toBe('LR');
  });

  it('honors an explicit rankdir', () => {
    expect(resolveDotLayout('digraph { rankdir=TB; A -> B }')).toBe('TB');
  });

  it('forced layout wins over an explicit rankdir', () => {
    expect(resolveDotLayout('digraph { rankdir=TB; A -> B }', 'LR')).toBe('LR');
  });

  it('treats RL/BT as horizontal/vertical families', () => {
    expect(resolveDotLayout('digraph { rankdir=RL; A -> B }')).toBe('LR');
    expect(resolveDotLayout('digraph { rankdir=BT; A -> B }')).toBe('TB');
  });
});

describe('getGraphvizCacheKey', () => {
  it('includes theme, layout, and dot hash', () => {
    const key = getGraphvizCacheKey('digraph { A -> B }', { themeId: 'pearl' });
    expect(key).toContain('pearl');
    expect(key).toContain('LR');
  });

  it('differs when layout differs for the same dot', () => {
    const lr = getGraphvizCacheKey('digraph { rankdir=TB; A -> B }', { layout: 'LR' });
    const tb = getGraphvizCacheKey('digraph { rankdir=TB; A -> B }', { layout: 'TB' });
    expect(lr).not.toBe(tb);
  });
});

describe('renderDotToSvg', () => {
  it('returns empty for blank DOT', async () => {
    const result = await renderDotToSvg('   \n  ');
    expect(result).toEqual({ ok: false, error: 'empty' });
  });

  it('returns too-large when the DOT exceeds char or edge limits', async () => {
    const longDot = `digraph { ${'a'.repeat(DOT_MAX_CHARS + 10)} }`;
    expect(await renderDotToSvg(longDot)).toMatchObject({ ok: false, error: 'too-large' });

    const manyEdges = `digraph { ${'A->B; '.repeat(DOT_MAX_EDGES + 1)} }`;
    expect(await renderDotToSvg(manyEdges)).toMatchObject({ ok: false, error: 'too-large' });
  });

  it('returns too-large when the DOT exceeds the node limit', async () => {
    const dot = `digraph { ${Array.from({ length: 41 }, (_, i) => `n${i}`).join('; ')}; }`;
    expect(await renderDotToSvg(dot)).toMatchObject({ ok: false, error: 'too-large' });
  });

  it('returns render-failed when viz throws', async () => {
    fakeInstance.renderSVGElement.mockRejectedValueOnce(new Error('WASM failed'));
    const result = await renderDotToSvg('digraph { Fail -> Test }');
    expect(result).toMatchObject({ ok: false, error: 'render-failed', message: 'WASM failed' });
  });

  it('injects a transparent theme background and default LR layout', async () => {
    const result = await renderDotToSvg('digraph { Theme -> Test }', { themeId: 'pearl' });
    expect(result.ok).toBe(true);
    const code = readProcessedCode((result as { ok: true; svg: string }).svg);
    expect(code).toContain('bgcolor="transparent"');
    expect(code).toContain('rankdir="LR"');
    // Pearl primary text is near-black; the injected graph fontcolor must match.
    expect(code).toContain('#1a1a1f');
  });

  it('rewrites an explicit rankdir when a layout is forced', async () => {
    const result = await renderDotToSvg('digraph { rankdir=TB; ForceLayout -> Test }', { layout: 'LR' });
    expect(result.ok).toBe(true);
    expect(readProcessedCode((result as { ok: true; svg: string }).svg)).toContain('rankdir="LR"');
  });

  it('maps semantic color names to theme values', async () => {
    const result = await renderDotToSvg(
      'digraph { ColorNode[color=success]; WarnNode[fontcolor=warning]; ColorNode->WarnNode; }',
      {
        themeId: 'onyx',
      },
    );
    expect(result.ok).toBe(true);
    const code = readProcessedCode((result as { ok: true; svg: string }).svg);
    expect(code).toContain('#4ade80'); // onyx textSuccess
    expect(code).toContain('#fbbf24'); // onyx textWarning
  });

  it('does not rewrite a color word inside a label', async () => {
    const result = await renderDotToSvg('digraph { LabelNode[label="accent is blue"] }', { themeId: 'pearl' });
    expect(result.ok).toBe(true);
    expect(readProcessedCode((result as { ok: true; svg: string }).svg)).toContain('accent is blue');
  });

  it('sanitizes injected script/event-handler/javascript hrefs out of viz output', async () => {
    fakeInstance.renderSVGElement.mockImplementationOnce(async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('onload', 'alert(1)');
      svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'script'));
      const badAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
      badAnchor.setAttribute('href', 'javascript:alert(2)');
      svg.appendChild(badAnchor);
      return svg;
    });

    const result = await renderDotToSvg('digraph { Sanitize -> Test }');
    expect(result.ok).toBe(true);
    const svg = (result as { ok: true; svg: string }).svg;
    expect(svg).not.toContain('onload');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('<a');
  });
});

describe('renderDotToSvgCached', () => {
  it('serves the second call from cache without re-rendering', async () => {
    const first = await renderDotToSvgCached('digraph { CacheHit -> Test }', { themeId: 'pearl' });
    expect(first.ok).toBe(true);
    const rendersAfterFirst = fakeInstance.renderSVGElement.mock.calls.length;

    const second = await renderDotToSvgCached('digraph { CacheHit -> Test }', { themeId: 'pearl' });
    expect(second.ok).toBe(true);
    expect(fakeInstance.renderSVGElement.mock.calls.length).toBe(rendersAfterFirst);
  });

  it('keeps distinct entries for distinct theme/layout combos', async () => {
    await renderDotToSvgCached('digraph { DistinctA -> Test }', { themeId: 'pearl', layout: 'LR' });
    await renderDotToSvgCached('digraph { DistinctB -> Test }', { themeId: 'onyx', layout: 'TB' });
    expect(fakeInstance.renderSVGElement.mock.calls.length).toBe(2);
  });

  it('does not cache a failed render', async () => {
    fakeInstance.renderSVGElement.mockRejectedValueOnce(new Error('boom'));
    const first = await renderDotToSvgCached('digraph { NoCacheFail -> Test }', { themeId: 'pearl' });
    expect(first).toMatchObject({ ok: false, error: 'render-failed' });

    const second = await renderDotToSvgCached('digraph { NoCacheFail -> Test }', { themeId: 'pearl' });
    expect(second.ok).toBe(true);
  });
});

describe('hydrateGraphvizIntoDocument', () => {
  it('injects static SVG into data-amc-graphviz nodes', async () => {
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div data-amc-graphviz="digraph { Hydrate -> Test }"></div></body></html>',
      'text/html',
    );
    await hydrateGraphvizIntoDocument(doc, { themeId: 'pearl' });

    const node = doc.querySelector('[data-amc-graphviz]')!;
    expect(node.querySelector('svg')).not.toBeNull();
  });

  it('leaves nodes untouched when rendering fails', async () => {
    fakeInstance.renderSVGElement.mockRejectedValue(new Error('boom'));
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body><div data-amc-graphviz="digraph { HydrateFail -> Test }">placeholder</div></body></html>',
      'text/html',
    );
    await hydrateGraphvizIntoDocument(doc, { themeId: 'pearl' });

    const node = doc.querySelector('[data-amc-graphviz]')!;
    expect(node.querySelector('svg')).toBeNull();
    expect(node.textContent).toContain('placeholder');
  });
});
