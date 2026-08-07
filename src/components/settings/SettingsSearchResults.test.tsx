import { act } from 'react';
import { setupTestRenderer } from '@/test/render/renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsSearchResult } from '@/utils/settingsSearch';
import { SettingsSearchResults } from './SettingsSearchResults';

const makeResult = (id: string, overrides: Partial<SettingsSearchResult> = {}): SettingsSearchResult => ({
  id,
  tab: 'interface',
  labelKey: id,
  label: id,
  tabLabel: 'Interface & Interaction',
  groupLabel: 'Input Toolbar',
  description: `${id} description`,
  ...overrides,
});

describe('SettingsSearchResults', () => {
  const renderer = setupTestRenderer();

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the empty state when there are no results', () => {
    act(() => {
      renderer.root.render(<SettingsSearchResults results={[]} onSelect={vi.fn()} selectedIndex={0} query="theme" />);
    });

    expect(renderer.container.textContent).toContain('No matching settings');
  });

  it('highlights matching query terms with <mark>', () => {
    act(() => {
      renderer.root.render(
        <SettingsSearchResults
          results={[makeResult('interface-theme')]}
          onSelect={vi.fn()}
          selectedIndex={0}
          query="theme"
        />,
      );
    });

    const marks = renderer.container.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe('theme');
  });

  it('highlights every term in a multi-word query', () => {
    act(() => {
      renderer.root.render(
        <SettingsSearchResults
          results={[makeResult('interface-font-size', { label: 'Font Size' })]}
          onSelect={vi.fn()}
          selectedIndex={0}
          query="font size"
        />,
      );
    });

    const marks = Array.from(renderer.container.querySelectorAll('mark')).map((m) => m.textContent);
    expect(marks).toContain('Font');
    expect(marks).toContain('Size');
  });

  it('shows a Tab > Group breadcrumb in flat mode', () => {
    act(() => {
      renderer.root.render(
        <SettingsSearchResults
          results={[makeResult('interface-theme')]}
          onSelect={vi.fn()}
          selectedIndex={0}
          query="theme"
        />,
      );
    });

    const text = renderer.container.textContent ?? '';
    expect(text).toContain('Interface & Interaction');
    expect(text).toContain('Input Toolbar');
  });

  it('groups results by tab with counts when above the threshold', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`m-${i}`, { tab: i % 2 === 0 ? 'models' : 'api', groupLabel: undefined }),
    );

    act(() => {
      renderer.root.render(
        <SettingsSearchResults results={results} onSelect={vi.fn()} selectedIndex={0} query="theme" />,
      );
    });

    const headings = Array.from(renderer.container.querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings.some((h) => h?.startsWith('Models') && h.includes('(5)'))).toBe(true);
    expect(headings.some((h) => h?.startsWith('API') && h.includes('(5)'))).toBe(true);
  });

  it('omits the Tab breadcrumb inside grouped mode (tab shown in the heading)', () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`m-${i}`, { tab: 'models', groupLabel: 'Model Settings' }),
    );

    act(() => {
      renderer.root.render(
        <SettingsSearchResults results={results} onSelect={vi.fn()} selectedIndex={0} query="theme" />,
      );
    });

    // Grouped mode: the group heading carries the tab name; items only show groupLabel.
    const crumbText = renderer.container.querySelector('ul')?.textContent ?? '';
    expect(crumbText).toContain('Model Settings');
    expect(crumbText).not.toContain('Interface & Interaction');
  });

  it('marks the flat selectedIndex item across group boundaries with data-selected', () => {
    // 10 results: 5 in models, 5 in api. selectedIndex 7 lands in the second group.
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`m-${i}`, { tab: i < 5 ? 'models' : 'api', groupLabel: undefined }),
    );

    act(() => {
      renderer.root.render(
        <SettingsSearchResults results={results} onSelect={vi.fn()} selectedIndex={7} query="theme" />,
      );
    });

    const selected = renderer.container.querySelector('[data-selected="true"]');
    expect(selected).not.toBeNull();
    expect(selected?.textContent).toContain('m-7');
  });

  it('scrolls the selected item into view when the selection changes', () => {
    const results = Array.from({ length: 3 }, (_, i) => makeResult(`m-${i}`));

    act(() => {
      renderer.root.render(
        <SettingsSearchResults results={results} onSelect={vi.fn()} selectedIndex={0} query="theme" />,
      );
    });

    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    act(() => {
      renderer.root.render(
        <SettingsSearchResults results={results} onSelect={vi.fn()} selectedIndex={2} query="theme" />,
      );
    });

    expect(scrollSpy).toHaveBeenCalled();
  });
});
