import { describe, expect, it } from 'vitest';

import { createAppSettings, createChatSettings } from '@/test/data/factories';
import { createDefaultThirdPartyApiSettings } from './thirdPartyApiProviders';
import { resolveChatApiRoute } from './chatApiRoute';

describe('resolveChatApiRoute', () => {
  it('uses the session provider and model instead of the global active provider', () => {
    const providers = createDefaultThirdPartyApiSettings().providers;
    const appSettings = createAppSettings({
      apiMode: 'gemini-native',
      isThirdPartyApiEnabled: true,
      thirdPartyApi: {
        activeProvider: 'openai',
        providers: {
          ...providers,
          openai: {
            ...providers.openai,
            apiKey: 'openai-key',
            enabled: true,
            modelId: 'gpt-5.6-sol',
          },
          kimi: {
            ...providers.kimi,
            apiKey: 'kimi-key',
            enabled: true,
            modelId: 'kimi-k3',
          },
        },
      },
    });
    const chatSettings = createChatSettings({
      apiMode: 'third-party',
      modelId: 'kimi-k3',
      thirdPartyProviderId: 'kimi',
      thirdPartyModelId: 'kimi-k3',
    });

    expect(resolveChatApiRoute(appSettings, chatSettings)).toMatchObject({
      apiMode: 'third-party',
      modelId: 'kimi-k3',
      providerId: 'kimi',
      provider: expect.objectContaining({ apiKey: 'kimi-key' }),
    });
  });
});
