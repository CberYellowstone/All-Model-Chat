import { describe, expect, it } from 'vitest';

import { MediaResolution, type ChatSettings } from '@/types';
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

  it('fully inherits all template settings including Maps, Pyodide, Keep Thinking and mediaResolution', () => {
    const appSettings = createAppSettings({
      modelId: 'gemini-3-flash-preview',
      isGoogleSearchEnabled: false,
    });
    const templateSession = createSavedChatSession({
      id: 'template',
      title: 'Previous Chat',
      timestamp: Date.now(),
      messages: [],
      settings: createChatSettings({
        modelId: 'gemini-3-pro-preview',
        isGoogleSearchEnabled: true,
        isGoogleMapsEnabled: true,
        isCodeExecutionEnabled: true,
        isLocalPythonEnabled: true,
        isUrlContextEnabled: true,
        isDeepSearchEnabled: true,
        alwaysKeepThinkingInContext: true,
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
        thinkingLevel: 'HIGH',
        ttsVoice: 'Aoede',
      }),
    });

    const settings: ChatSettings = createSettingsForNewChat({
      appSettings,
      savedSessions: [templateSession],
    });

    expect(settings.modelId).toBe('gemini-3-pro-preview');
    expect(settings.isGoogleSearchEnabled).toBe(true);
    expect(settings.isGoogleMapsEnabled).toBe(true);
    expect(settings.isCodeExecutionEnabled).toBe(true);
    expect(settings.isLocalPythonEnabled).toBe(true);
    expect(settings.isUrlContextEnabled).toBe(true);
    expect(settings.isDeepSearchEnabled).toBe(true);
    expect(settings.alwaysKeepThinkingInContext).toBe(true);
    expect(settings.mediaResolution).toBe(MediaResolution.MEDIA_RESOLUTION_HIGH);
    expect(settings.thinkingLevel).toBe('HIGH');
    expect(settings.ttsVoice).toBe('Aoede');
  });
});
