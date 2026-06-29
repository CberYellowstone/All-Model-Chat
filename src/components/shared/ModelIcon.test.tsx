import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { ModelOption, ThirdPartyProviderId } from '@/types';
import { getModelIcon } from './ModelIcon';

const getIconClassName = (model: ModelOption): string => {
  const icon = getModelIcon(model) as ReactElement<{ className?: string }>;
  return icon.props.className ?? '';
};

describe('getModelIcon', () => {
  it('colors third-party models by provider instead of falling back to the Gemini sparkle', () => {
    const className = getIconClassName({
      id: 'claude-fable-5',
      name: 'Claude Fable 5',
      isPinned: true,
      apiMode: 'third-party',
      providerId: 'anthropic',
    });

    expect(className).toContain('text-orange');
    expect(className).not.toContain('text-sky');
  });

  it('keeps pinned non-provider models on the sparkle icon', () => {
    const className = getIconClassName({
      id: 'some-pinned-model',
      name: 'Some Pinned Model',
      isPinned: true,
    });

    expect(className).toContain('text-sky');
  });

  it.each([
    ['openai', 'text-emerald'],
    ['anthropic', 'text-orange'],
    ['qwen', 'text-violet'],
    ['deepseek', 'text-blue'],
    ['kimi', 'text-cyan'],
    ['glm', 'text-rose'],
    ['openrouter', 'text-fuchsia'],
    ['custom', 'text-slate'],
  ] as const)('assigns a distinct color to provider %s', (providerId: ThirdPartyProviderId, expectedColor: string) => {
    const className = getIconClassName({
      id: `${providerId}-model`,
      name: `${providerId} model`,
      isPinned: true,
      apiMode: 'third-party',
      providerId,
    });

    expect(className).toContain(expectedColor);
  });
});
