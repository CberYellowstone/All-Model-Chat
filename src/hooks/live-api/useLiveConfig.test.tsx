import { describe, expect, it } from 'vitest';
import { LOCAL_PYTHON_SYSTEM_PROMPT } from '@/features/prompts/localPython';
import { MediaResolution, type LiveClientFunctions } from '@/types';
import { useLiveConfig } from './useLiveConfig';
import { createChatSettings } from '@/test/data/factories';
import { renderHook } from '@/test/render/renderer';

const createLiveClientFunctions = (overrides: LiveClientFunctions): LiveClientFunctions => overrides;

const baseChatSettings = createChatSettings({
  modelId: 'gemini-3.1-flash-live-preview',
  temperature: 1,
  topP: 0.95,
  topK: 64,
  showThoughts: true,
  systemInstruction: '',
  ttsVoice: 'Zephyr',
  thinkingBudget: -1,
  thinkingLevel: 'LOW' as const,
  lockedApiKey: null,
  isGoogleSearchEnabled: false,
  isCodeExecutionEnabled: false,
  isLocalPythonEnabled: false,
  isUrlContextEnabled: false,
  isDeepSearchEnabled: false,
  isRawModeEnabled: false,
  hideThinkingInContext: false,
  safetySettings: [],
  mediaResolution: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
});

describe('useLiveConfig', () => {
  it('enables session resumption from the first connection', () => {
    const { result, unmount } = renderHook(() =>
      useLiveConfig({
        chatSettings: baseChatSettings,
        sessionHandle: null,
      }),
    );

    expect(result.current.liveConfig.sessionResumption).toEqual({});
    unmount();
  });

  it('uses thinkingLevel for Gemini 3.1 Flash Live sessions', () => {
    const { result, unmount } = renderHook(() =>
      useLiveConfig({
        chatSettings: baseChatSettings,
        sessionHandle: null,
      }),
    );

    expect(result.current.liveConfig.thinkingConfig).toEqual({
      includeThoughts: true,
      thinkingLevel: 'LOW',
    });
    unmount();
  });

  it('declares client-side function tools when provided', () => {
    const { result, unmount } = renderHook(() =>
      useLiveConfig({
        chatSettings: baseChatSettings,
        sessionHandle: null,
        clientFunctions: createLiveClientFunctions({
          turn_on_the_lights: {
            declaration: {
              name: 'turn_on_the_lights',
              description: 'Turns on the lights.',
            },
            handler: async () => ({ response: 'ok' }),
          },
        }),
      }),
    );

    expect(result.current.liveConfig.tools).toContainEqual({
      functionDeclarations: [
        {
          name: 'turn_on_the_lights',
          description: 'Turns on the lights.',
        },
      ],
    });
    unmount();
  });

  it('appends the local python execution prompt when the live session exposes run_local_python', () => {
    const { result, unmount } = renderHook(() =>
      useLiveConfig({
        chatSettings: createChatSettings({
          ...baseChatSettings,
          systemInstruction: 'Custom live instruction',
        }),
        sessionHandle: null,
        clientFunctions: createLiveClientFunctions({
          run_local_python: {
            declaration: {
              name: 'run_local_python',
              description: 'Runs Python locally.',
            },
            handler: async () => ({ response: 'ok' }),
          },
        }),
      }),
    );

    expect(result.current.liveConfig.systemInstruction).toEqual({
      parts: [
        {
          text: `Custom live instruction\n\n${LOCAL_PYTHON_SYSTEM_PROMPT}`,
        },
      ],
    });
    unmount();
  });

  it('emits a stripped-down config for live-translate models', () => {
    const { result, unmount } = renderHook(() =>
      useLiveConfig({
        chatSettings: createChatSettings({
          ...baseChatSettings,
          modelId: 'gemini-3.5-live-translate-preview',
        }),
        sessionHandle: null,
      }),
    );

    expect(result.current.liveConfig.responseModalities).toEqual(['AUDIO']);
    // 未传 liveTranslateLanguages 时走默认 { sourceLanguage: 'auto', targetLanguage: 'English' }
    expect(result.current.liveConfig.systemInstruction).toEqual({
      parts: [{ text: 'Translate into English.' }],
    });
    expect(result.current.liveConfig).not.toHaveProperty('speechConfig');
    expect(result.current.liveConfig).not.toHaveProperty('tools');
    expect(result.current.liveConfig).not.toHaveProperty('inputAudioTranscription');
    expect(result.current.liveConfig).not.toHaveProperty('contextWindowCompression');
    expect(result.current.liveConfig).not.toHaveProperty('thinkingConfig');
    // tools 数组应为空（builder 不产生 tools）
    expect(result.current.tools).toEqual([]);
    unmount();
  });

  it('uses the provided language direction for live-translate models', () => {
    const { result, unmount } = renderHook(() =>
      useLiveConfig({
        chatSettings: createChatSettings({
          ...baseChatSettings,
          modelId: 'gemini-3.5-live-translate-preview',
        }),
        sessionHandle: null,
        liveTranslateLanguages: { sourceLanguage: 'English', targetLanguage: 'Japanese' },
      }),
    );

    expect(result.current.liveConfig.systemInstruction).toEqual({
      parts: [{ text: 'Translate from English into Japanese.' }],
    });
    unmount();
  });
});
