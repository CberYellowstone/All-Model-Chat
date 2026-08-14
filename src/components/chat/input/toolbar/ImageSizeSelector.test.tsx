import { act } from 'react';
import { setupTestRenderer } from '@/test/render/renderer';
import { describe, expect, it, vi } from 'vitest';
import { ImageSizeSelector } from './ImageSizeSelector';

describe('ImageSizeSelector', () => {
  const renderer = setupTestRenderer();

  it('hides when there is only one supported size', () => {
    act(() => {
      renderer.root.render(<ImageSizeSelector imageSize="1K" setImageSize={vi.fn()} supportedSizes={['1K']} />);
    });

    expect(renderer.container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('renders a segmented control when multiple sizes are available', () => {
    const setImageSize = vi.fn();

    act(() => {
      renderer.root.render(
        <ImageSizeSelector imageSize="1K" setImageSize={setImageSize} supportedSizes={['512', '1K', '2K', '4K']} />,
      );
    });

    const group = renderer.container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(renderer.container.querySelectorAll('[role="radio"]')).toHaveLength(4);

    const twoK = Array.from(renderer.container.querySelectorAll('button')).find(
      (button) => button.textContent === '2K',
    );
    act(() => {
      twoK?.click();
    });
    expect(setImageSize).toHaveBeenCalledWith('2K');
  });
});
