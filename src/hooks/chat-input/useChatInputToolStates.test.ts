import { describe, expect, it } from 'vitest';
import type { ChatSettings } from '@/types';
import { createChatSettings } from '@/test/data/factories';
import { getNextSettingsForToolToggle } from './useChatInputToolStates';

const settings = (overrides: Partial<ChatSettings> = {}): ChatSettings =>
  createChatSettings({ modelId: 'gemma-3-27b-it', ...overrides });

describe('getNextSettingsForToolToggle — keep thinking', () => {
  it('enables alwaysKeepThinkingInContext when off', () => {
    const next = getNextSettingsForToolToggle(settings(), 'alwaysKeepThinking');
    expect(next.alwaysKeepThinkingInContext).toBe(true);
  });

  it('disables alwaysKeepThinkingInContext when on', () => {
    const next = getNextSettingsForToolToggle(settings({ alwaysKeepThinkingInContext: true }), 'alwaysKeepThinking');
    expect(next.alwaysKeepThinkingInContext).toBe(false);
  });

  it('clears hideThinkingInContext when enabling keep (mutual exclusion)', () => {
    const next = getNextSettingsForToolToggle(
      settings({ hideThinkingInContext: true, alwaysKeepThinkingInContext: false }),
      'alwaysKeepThinking',
    );
    expect(next.alwaysKeepThinkingInContext).toBe(true);
    expect(next.hideThinkingInContext).toBe(false);
  });

  it('leaves hideThinkingInContext untouched when disabling keep', () => {
    const next = getNextSettingsForToolToggle(
      settings({ hideThinkingInContext: true, alwaysKeepThinkingInContext: true }),
      'alwaysKeepThinking',
    );
    expect(next.alwaysKeepThinkingInContext).toBe(false);
    // Only the enable direction enforces the mutex; disabling keep keeps hide as-is.
    expect(next.hideThinkingInContext).toBe(true);
  });

  it('does not touch other tool settings', () => {
    const next = getNextSettingsForToolToggle(
      settings({ isDeepSearchEnabled: true, isUrlContextEnabled: true, alwaysKeepThinkingInContext: false }),
      'alwaysKeepThinking',
    );
    expect(next.isDeepSearchEnabled).toBe(true);
    expect(next.isUrlContextEnabled).toBe(true);
  });
});
