import { act } from 'react';
import { setupProviderTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it } from 'vitest';
import { ThinkingStrip } from './ThinkingStrip';

describe('ThinkingStrip', () => {
  const renderer = setupProviderTestRenderer({ providers: { language: 'en' } });

  it('renders nothing when there is no last thought', () => {
    act(() => {
      renderer.render(<ThinkingStrip lastThought={null} />);
    });

    expect(renderer.container.querySelector('[data-thinking-strip="true"]')).toBeNull();
  });

  it('renders the title and content lines when both are present', () => {
    act(() => {
      renderer.render(
        <ThinkingStrip
          lastThought={{ title: 'Analyze file structure', content: 'Reading 12 files…', isFallback: false }}
        />,
      );
    });

    const strip = renderer.container.querySelector('[data-thinking-strip="true"]');
    expect(strip).not.toBeNull();
    expect(strip?.textContent).toContain('Analyze file structure');
    expect(strip?.textContent).toContain('Reading 12 files…');
    expect(strip?.querySelector('.line-clamp-2')).not.toBeNull();
  });

  it('animates the dot as a loading indicator', () => {
    act(() => {
      renderer.render(<ThinkingStrip lastThought={{ title: 'Step', content: '', isFallback: false }} />);
    });

    const dot = renderer.container.querySelector('[data-thinking-strip="true"] span[aria-hidden="true"]');
    expect(dot?.getAttribute('class')).toContain('animate-pulse');
  });

  it('uses the i18n label for fallback thoughts instead of a hardcoded string', () => {
    act(() => {
      renderer.render(
        <ThinkingStrip lastThought={{ title: 'Latest thought', content: 'trailing content', isFallback: true }} />,
      );
    });

    expect(renderer.container.textContent).toContain('Latest thought');
  });

  it('omits the content line when there is no content', () => {
    act(() => {
      renderer.render(<ThinkingStrip lastThought={{ title: 'Only a title', content: '', isFallback: false }} />);
    });

    const strip = renderer.container.querySelector('[data-thinking-strip="true"]');
    expect(strip?.textContent).toContain('Only a title');
    expect(strip?.querySelector('.line-clamp-2')).toBeNull();
  });
});
