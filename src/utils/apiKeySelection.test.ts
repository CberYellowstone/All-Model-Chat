import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@/constants/settingsDefaults';
import { type ChatSettings, GEMINI_PROVIDER_ID } from '@/types';
import {
  formatApiKeyErrorMessage,
  getGeminiKeyForRequest,
  getKeyForRequest,
  isServerManagedApiEnabledForProxyRequests,
  SERVER_MANAGED_API_KEY,
} from './apiKeySelection';
import { logService } from '@/services/logService';

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createLogServiceMockModule();
});

describe('getKeyForRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const chatSettings: ChatSettings = {
    modelId: 'gemini-2.5-flash-preview-09-2025',
    providerId: GEMINI_PROVIDER_ID,
    temperature: 1,
    topP: 0.95,
    topK: 64,
    showThoughts: false,
    systemInstruction: '',
    ttsVoice: 'Puck',
    thinkingBudget: 0,
  };

  const openaiProvider = { ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers.openai, apiKey: 'openai-key' };

  it('returns server-managed marker key when using proxy custom config with no browser key', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
        apiKey: null,
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: SERVER_MANAGED_API_KEY,
      isNewKey: false,
    });
  });

  it('keeps legacy API key missing error when server-managed flow is not enabled', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: false,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
        apiKey: null,
      },
      chatSettings,
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });

  it('uses real configured API key when server-managed mode is enabled but key exists', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
        apiKey: 'real-browser-key',
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: 'real-browser-key',
      isNewKey: true,
    });
  });

  it('uses the provider key when the session routes to that third-party provider', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        thirdPartyApi: {
          activeProvider: 'openai',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            openai: openaiProvider,
          },
        },
      },
      {
        ...chatSettings,
        modelId: openaiProvider.modelId,
        providerId: 'openai',
      },
    );

    expect(result).toEqual({
      key: 'openai-key',
      isNewKey: true,
    });
  });

  it('resolves the provider from the modelId when the session has no explicit providerId', () => {
    // A legacy session with no providerId whose modelId belongs to an enabled
    // provider routes there (composite-key lookup).
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        thirdPartyApi: {
          activeProvider: 'openai',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            openai: { ...openaiProvider, enabled: true },
          },
        },
      },
      {
        ...chatSettings,
        modelId: 'gpt-5.6-sol',
        providerId: undefined,
      },
    );

    expect(result).toEqual({
      key: 'openai-key',
      isNewKey: true,
    });
  });

  it('uses the explicit session provider key even when the global activeProvider differs', () => {
    const kimiProvider = { ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers.kimi, apiKey: 'kimi-key' };
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        thirdPartyApi: {
          activeProvider: 'openai',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            openai: { ...openaiProvider, enabled: true },
            kimi: { ...kimiProvider, enabled: true },
          },
        },
      },
      {
        ...chatSettings,
        modelId: 'kimi-k3',
        providerId: 'kimi',
      },
    );

    expect(result).toEqual({ key: 'kimi-key', isNewKey: true });
  });

  it('reports a missing key when the routed provider has none', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        thirdPartyApi: {
          activeProvider: 'openai',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            openai: { ...openaiProvider, apiKey: null },
          },
        },
      },
      {
        ...chatSettings,
        modelId: 'gpt-5.6-sol',
        providerId: 'openai',
      },
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });

  it('uses Gemini key handling when the session routes to Gemini', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: 'gemini-key',
      isNewKey: true,
    });
  });

  it('can select a key without recording usage for Live token setup', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'real-browser-key',
      },
      chatSettings,
      { skipIncrement: true, skipUsageLogging: true },
    );

    expect(result).toEqual({
      key: 'real-browser-key',
      isNewKey: true,
    });
    expect(logService.recordApiKeyUsage).not.toHaveBeenCalled();
  });

  it('can force Gemini key handling while the session routes third-party', () => {
    const result = getGeminiKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        thirdPartyApi: {
          activeProvider: 'openai',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            openai: openaiProvider,
          },
        },
      },
      {
        ...chatSettings,
        modelId: openaiProvider.modelId,
        providerId: 'openai',
        lockedApiKey: 'openai-key',
      },
      { skipIncrement: true },
    );

    expect(result).toEqual({
      key: 'gemini-key',
      isNewKey: true,
    });
  });

  it('does not fall back to the third-party provider key when forcing Gemini key handling', () => {
    const result = getGeminiKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: null,
        thirdPartyApi: {
          activeProvider: 'openai',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            openai: openaiProvider,
          },
        },
      },
      {
        ...chatSettings,
        modelId: openaiProvider.modelId,
        providerId: 'openai',
      },
      { skipIncrement: true },
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });

  it('resolves the anthropic provider key when the session routes there', () => {
    const anthropicProvider = {
      apiKey: 'sk-ant-test',
      baseUrl: 'https://api.anthropic.com',
      modelId: 'claude-sonnet-5',
      models: [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5', isPinned: true }],
      protocol: 'anthropic' as const,
    };
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        thirdPartyApi: {
          activeProvider: 'anthropic',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            anthropic: anthropicProvider,
          },
        },
      },
      {
        ...chatSettings,
        modelId: 'claude-sonnet-5',
        providerId: 'anthropic',
      },
    );

    expect('key' in result).toBe(true);
    expect((result as { key: string }).key).toBe('sk-ant-test');
  });

  it('returns error when third-party provider has no api key', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        thirdPartyApi: {
          activeProvider: 'anthropic',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            anthropic: { ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers.anthropic, apiKey: null },
          },
        },
      },
      {
        ...chatSettings,
        modelId: 'claude-sonnet-5',
        providerId: 'anthropic',
      },
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });
});

describe('isServerManagedApiEnabledForProxyRequests', () => {
  it('returns true only when all required server-managed proxy conditions are met', () => {
    expect(
      isServerManagedApiEnabledForProxyRequests({
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
      }),
    ).toBe(true);

    expect(
      isServerManagedApiEnabledForProxyRequests({
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: '   ',
      }),
    ).toBe(false);
  });
});

describe('formatApiKeyErrorMessage', () => {
  it('translates known API key errors and keeps unknown messages intact', () => {
    const translate = vi.fn((translationKey: string) => `translated:${translationKey}`);

    expect(formatApiKeyErrorMessage('API Key not configured.', translate)).toBe(
      'translated:apiRuntimeKeyNotConfigured',
    );
    expect(formatApiKeyErrorMessage('custom failure', translate)).toBe('custom failure');
  });
});
