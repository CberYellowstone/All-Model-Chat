import { act } from 'react';
import { setupTestRenderer } from '@/test/render/renderer';
import { describe, expect, it } from 'vitest';
import { ThinkingHeader } from './ThinkingHeader';

describe('ThinkingHeader', () => {
  const renderer = setupTestRenderer();

  it('renders the loading spinner without accent background chrome', async () => {
    await act(async () => {
      renderer.root.render(<ThinkingHeader isLoading isExpanded={false} />);
    });

    const spinnerWrapper = renderer.container.querySelector('svg')?.parentElement;

    expect(spinnerWrapper).not.toBeNull();
    expect(spinnerWrapper?.className).not.toContain('rounded-lg');
    expect(spinnerWrapper?.className).not.toContain('bg-[var(--theme-bg-accent)]/10');
  });

  it('renders a check icon with the settled thinking time once loading finishes', async () => {
    await act(async () => {
      renderer.root.render(<ThinkingHeader isLoading={false} thinkingTimeMs={12000} isExpanded={false} />);
    });

    const check = renderer.container.querySelector('svg.lucide-check');
    expect(check).not.toBeNull();
    expect(check?.getAttribute('class')).toContain('text-[var(--theme-text-success)]');
    expect(renderer.container.textContent).toContain('12s');
  });

  it('keeps the THINKING label during loading instead of a step title', async () => {
    await act(async () => {
      renderer.root.render(<ThinkingHeader isLoading isExpanded={false} />);
    });

    expect(renderer.container.textContent).toContain('Thinking');
  });
});
