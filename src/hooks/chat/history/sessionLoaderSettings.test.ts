import { describe, expect, it } from 'vitest';

import { createAppSettings, createChatSettings, createSavedChatSession } from '@/test/data/factories';

import { createSettingsForNewChat } from './sessionLoaderSettings';

const LIVE_ARTIFACTS_PROMPT = '[Live Artifacts Protocol - zh]\nLive Artifacts prompt';

describe('createSettingsForNewChat', () => {
  it('inherits Live Artifacts systemInstruction from app settings for new chats', () => {
    const appSettings = createAppSettings({
      systemInstruction: LIVE_ARTIFACTS_PROMPT,
      modelId: 'gemini-3-flash-preview',
    });

    const settings = createSettingsForNewChat({
      appSettings,
      savedSessions: [],
    });

    expect(settings.systemInstruction).toBe(LIVE_ARTIFACTS_PROMPT);
  });

  it('keeps app Live Artifacts systemInstruction when a template session only supplies model flags', () => {
    const appSettings = createAppSettings({
      systemInstruction: LIVE_ARTIFACTS_PROMPT,
      modelId: 'gemini-3-flash-preview',
    });
    const templateSession = createSavedChatSession({
      id: 'template',
      title: 'Previous Chat',
      timestamp: Date.now(),
      messages: [],
      settings: createChatSettings({
        modelId: 'gemini-3-pro-preview',
        systemInstruction: '',
        isGoogleSearchEnabled: true,
      }),
    });

    const settings = createSettingsForNewChat({
      appSettings,
      savedSessions: [templateSession],
    });

    expect(settings.systemInstruction).toBe(LIVE_ARTIFACTS_PROMPT);
    expect(settings.modelId).toBe('gemini-3-pro-preview');
    expect(settings.isGoogleSearchEnabled).toBe(true);
  });
});
