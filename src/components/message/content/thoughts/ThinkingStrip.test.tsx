import { act } from 'react';
import { setupProviderTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it } from 'vitest';
import { ThinkingStrip } from './ThinkingStrip';
import { THINKING_STRIP_CONTENT_HEIGHT_REM } from './thinkingStripMetrics';

describe('ThinkingStrip', () => {
  const renderer = setupProviderTestRenderer({ providers: { language: 'en' } });

  it('renders nothing when there is no thought tail', () => {
    act(() => {
      renderer.render(<ThinkingStrip thoughtsTail="" />);
    });

    expect(renderer.container.querySelector('[data-thinking-strip="true"]')).toBeNull();
  });

  it('renders a fixed 5-line viewport containing the tail text', () => {
    act(() => {
      renderer.render(<ThinkingStrip thoughtsTail={'Line one\nLine two\nLine three\nLine four\nLine five'} />);
    });

    const strip = renderer.container.querySelector('[data-thinking-strip="true"]');
    const viewport = renderer.container.querySelector('[data-thinking-strip-viewport="true"]');

    expect(strip).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Fixed pixel height — line-clamp would only cap the maximum and let short
    // content shrink; the strip must always be exactly 5 text lines tall.
    expect((viewport as HTMLElement).style.height).toBe(`${THINKING_STRIP_CONTENT_HEIGHT_REM}rem`);
    expect(strip?.textContent).toContain('Line five');
    // Bottom-anchored scroll window: flex-col-reverse + overflow-y-auto.
    expect(viewport?.getAttribute('class')).toContain('flex-col-reverse');
    expect(viewport?.getAttribute('class')).toContain('overflow-y-auto');
  });

  it('renders no title row — only the plain-text tail', () => {
    act(() => {
      renderer.render(<ThinkingStrip thoughtsTail="Plan details" />);
    });

    const strip = renderer.container.querySelector('[data-thinking-strip="true"]');
    expect(strip?.textContent).toContain('Plan details');
    // The previous title span (truncate font-semibold) is gone.
    expect(strip?.querySelector('.truncate.font-semibold')).toBeNull();
    expect(strip?.querySelector('.font-semibold')).toBeNull();
  });
});
