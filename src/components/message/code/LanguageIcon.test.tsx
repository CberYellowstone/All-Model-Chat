import { act } from 'react';
import { setupTestRenderer } from '@/test/render/renderer';
import { describe, expect, it } from 'vitest';
import { LanguageIcon } from './LanguageIcon';

describe('LanguageIcon', () => {
  const renderer = setupTestRenderer();

  it('renders a branded Python badge with a normalized display label', () => {
    act(() => {
      renderer.root.render(<LanguageIcon language="py" />);
    });

    const badge = renderer.container.querySelector('[data-language-badge="python"]');
    const icon = renderer.container.querySelector('[data-language-icon="python"]');
    const meta = renderer.container.querySelector('[data-language-meta]');
    const svg = icon?.querySelector('svg');

    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Python');
    expect(badge?.className.split(/\s+/)).toContain('gap-1.5');
    expect(icon).not.toBeNull();
    expect(icon?.className.split(/\s+/)).toContain('h-5');
    // Slot is height-fixed only; SVG icons keep intrinsic 20×20, TextGlyph may grow wider
    expect(icon?.className.split(/\s+/)).not.toContain('w-5');
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
    // Square viewBox so the tall logo is not letterboxed smaller than peers
    expect(svg?.getAttribute('viewBox')).toBe('-15 0 140 140');
    expect(icon?.querySelector('[stop-color="#5a9fd4"]')).not.toBeNull();
    expect(icon?.querySelector('[stop-color="#ffd43b"]')).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(meta?.className.split(/\s+/)).toContain('inline-flex');
    expect(meta?.className.split(/\s+/)).toContain('items-center');
    expect(meta?.textContent).not.toContain('PY');
  });

  it('renders a single TSX label without a redundant compact tag', () => {
    act(() => {
      renderer.root.render(<LanguageIcon language="tsx" />);
    });

    const badge = renderer.container.querySelector('[data-language-badge="tsx"]');
    const icon = renderer.container.querySelector('[data-language-icon="tsx"]');
    const meta = renderer.container.querySelector('[data-language-meta]');

    expect(badge).not.toBeNull();
    expect(meta?.textContent?.trim()).toBe('TSX');
    expect(badge?.textContent).not.toContain('TypeScript React');
    expect(icon?.querySelector('svg')?.getAttribute('width')).toBe('20');
    expect(icon?.querySelector('svg')?.getAttribute('height')).toBe('20');
  });

  it('renders a single React label without a redundant JSX compact tag', () => {
    act(() => {
      renderer.root.render(<LanguageIcon language="jsx" />);
    });

    const meta = renderer.container.querySelector('[data-language-meta]');
    const icon = renderer.container.querySelector('[data-language-icon="react"]');

    expect(meta?.textContent?.trim()).toBe('React');
    expect(meta?.textContent).not.toMatch(/JSX/i);
    expect(icon?.querySelector('svg')?.getAttribute('width')).toBe('20');
    expect(icon?.querySelector('svg')?.getAttribute('height')).toBe('20');
  });

  it('avoids redundant compact labels for diagram and markdown languages', () => {
    const cases: Array<{ language: string; expected: string; forbidden?: RegExp }> = [
      { language: 'dot', expected: 'DOT' },
      { language: 'graphviz', expected: 'GraphvizDOT' }, // Graphviz + compact DOT
      { language: 'mermaid', expected: 'Mermaid' },
      { language: 'markdown', expected: 'Markdown' },
      { language: 'md', expected: 'Markdown' },
    ];

    cases.forEach(({ language, expected, forbidden }) => {
      act(() => {
        renderer.root.render(<LanguageIcon language={language} />);
      });

      const meta = renderer.container.querySelector('[data-language-meta]');
      expect(meta?.textContent?.replace(/\s+/g, '')).toBe(expected);
      if (forbidden) {
        expect(meta?.textContent).not.toMatch(forbidden);
      }
    });
  });

  it('lets TextGlyph badges grow with content instead of clipping at 20px', () => {
    act(() => {
      renderer.root.render(<LanguageIcon language="css" />);
    });

    const icon = renderer.container.querySelector('[data-language-icon="css"]');
    const glyph = icon?.querySelector('span');

    expect(glyph).not.toBeNull();
    expect(glyph?.className.split(/\s+/)).toContain('min-w-5');
    expect(glyph?.className.split(/\s+/)).toContain('text-[9px]');
    expect(glyph?.className.split(/\s+/)).not.toContain('max-w-5');
    expect(icon?.className.split(/\s+/)).not.toContain('w-5');

    act(() => {
      renderer.root.render(<LanguageIcon language="js" />);
    });

    const jsIcon = renderer.container.querySelector('[data-language-icon="javascript"]');
    const jsGlyph = jsIcon?.querySelector('span');

    expect(jsGlyph).not.toBeNull();
    expect(jsGlyph?.className.split(/\s+/)).toContain('min-w-5');
    expect(jsGlyph?.className.split(/\s+/)).toContain('text-xs');
    expect(jsGlyph?.className.split(/\s+/)).not.toContain('max-w-5');
    expect(jsIcon?.className.split(/\s+/)).not.toContain('w-5');
  });

  it('renders TypeScript code blocks with the SVG language icon', () => {
    act(() => {
      renderer.root.render(<LanguageIcon language="typescript" />);
    });

    const badge = renderer.container.querySelector('[data-language-badge="typescript"]');
    const icon = renderer.container.querySelector('[data-language-icon="typescript"]');

    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('TypeScript');
    expect(icon?.querySelector('svg')?.getAttribute('width')).toBe('20');
    expect(icon?.querySelector('svg')?.getAttribute('height')).toBe('20');
    expect(icon?.textContent).not.toContain('TS');
  });

  it('renders dedicated SVG icons for common code block languages', () => {
    const cases = [
      ['go', 'go', 'Go'],
      ['golang', 'go', 'Go'],
      ['rust', 'rust', 'Rust'],
      ['rs', 'rust', 'Rust'],
      ['java', 'java', 'Java'],
      ['cs', 'csharp', 'C#'],
      ['csharp', 'csharp', 'C#'],
      ['kotlin', 'kotlin', 'Kotlin'],
      ['kt', 'kotlin', 'Kotlin'],
      ['ruby', 'ruby', 'Ruby'],
      ['rb', 'ruby', 'Ruby'],
      ['php', 'php', 'PHP'],
      ['swift', 'swift', 'Swift'],
      ['dart', 'dart', 'Dart'],
      ['lua', 'lua', 'Lua'],
      ['c', 'c', 'C'],
      ['cpp', 'cpp', 'C++'],
      ['c++', 'cpp', 'C++'],
      ['sql', 'sql', 'SQL'],
      ['postgresql', 'sql', 'SQL'],
      ['bash', 'shell', 'Shell'],
      ['powershell', 'shell', 'Shell'],
      ['yaml', 'yaml', 'YAML'],
      ['toml', 'toml', 'TOML'],
      ['ini', 'ini', 'INI'],
    ];

    cases.forEach(([language, iconId, label]) => {
      act(() => {
        renderer.root.render(<LanguageIcon language={language} />);
      });

      const icon = renderer.container.querySelector(`[data-language-icon="${iconId}"]`);
      const badge = renderer.container.querySelector('[data-language-badge]');

      expect(badge?.textContent).toContain(label);
      expect(icon?.querySelector('svg')?.getAttribute('width')).toBe('20');
      expect(icon?.querySelector('svg')?.getAttribute('height')).toBe('20');
    });
  });

  it('falls back to a generic code badge for unknown languages', () => {
    act(() => {
      renderer.root.render(<LanguageIcon language="brainfuck" />);
    });

    const badge = renderer.container.querySelector('[data-language-badge="brainfuck"]');
    const icon = renderer.container.querySelector('[data-language-icon="generic"]');

    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('brainfuck');
    expect(icon).not.toBeNull();
    expect(icon?.querySelector('svg')?.getAttribute('width')).toBe('20');
  });
});
