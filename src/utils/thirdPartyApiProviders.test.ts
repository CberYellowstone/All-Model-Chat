import { describe, expect, it } from 'vitest';

import { createAppSettings } from '@/test/data/factories';
import {
  buildProviderAwareModelList,
  createDefaultThirdPartyApiSettings,
  resolveProviderForModelId,
  sanitizeThirdPartyApiSettings,
} from './thirdPartyApiProviders';

describe('sanitizeThirdPartyApiSettings', () => {
  it('drops a legacy activeProvider field from the output', () => {
    const input = {
      activeProvider: 'deepseek',
      providers: createDefaultThirdPartyApiSettings().providers,
    };
    const result = sanitizeThirdPartyApiSettings(input as Parameters<typeof sanitizeThirdPartyApiSettings>[0]);

    expect(result).not.toHaveProperty('activeProvider');
    expect(result.providers.deepseek).toBeDefined();
  });
});

describe('resolveProviderForModelId', () => {
  it('returns the enabled provider that contains the modelId', () => {
    const appSettings = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...createDefaultThirdPartyApiSettings().providers,
          openai: {
            ...createDefaultThirdPartyApiSettings().providers.openai,
            enabled: true,
            models: [{ id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' }],
          },
        },
      },
    });

    expect(resolveProviderForModelId(appSettings, 'gpt-5.6-sol')).toMatchObject({ id: 'openai' });
  });

  it('returns undefined when the modelId belongs to no enabled provider (no fallback)', () => {
    const appSettings = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...createDefaultThirdPartyApiSettings().providers,
          openai: {
            ...createDefaultThirdPartyApiSettings().providers.openai,
            enabled: true,
            models: [{ id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' }],
          },
        },
      },
    });

    // A Gemini model id must NOT fall back to a third-party provider.
    expect(resolveProviderForModelId(appSettings, 'gemini-3.1-pro-preview')).toBeUndefined();
  });

  it('ignores disabled providers', () => {
    const appSettings = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...createDefaultThirdPartyApiSettings().providers,
          openai: {
            ...createDefaultThirdPartyApiSettings().providers.openai,
            enabled: false,
            models: [{ id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' }],
          },
        },
      },
    });

    expect(resolveProviderForModelId(appSettings, 'gpt-5.6-sol')).toBeUndefined();
  });
});

describe('buildProviderAwareModelList', () => {
  it('keeps same-named model ids from different providers both present', () => {
    const providers = createDefaultThirdPartyApiSettings().providers;
    const appSettings = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...providers,
          openai: {
            ...providers.openai,
            enabled: true,
            models: [{ id: 'gpt-4o', name: 'OpenAI GPT-4o' }],
          },
          kimi: {
            ...providers.kimi,
            enabled: true,
            models: [{ id: 'gpt-4o', name: 'Kimi GPT-4o' }],
          },
        },
      },
    });

    const result = buildProviderAwareModelList(appSettings, [{ id: 'gemini-3-flash', name: 'Gemini 3 Flash' }]);

    const gpt4o = result.filter((m) => m.id === 'gpt-4o');
    expect(gpt4o).toHaveLength(2);
    // Each carries its own providerId.
    expect(gpt4o.map((m) => m.providerId).sort()).toEqual(['kimi', 'openai']);
  });

  it('still deduplicates within a single provider list', () => {
    const providers = createDefaultThirdPartyApiSettings().providers;
    const appSettings = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...providers,
          openai: {
            ...providers.openai,
            enabled: true,
            models: [
              { id: 'gpt-4o', name: 'GPT-4o' },
              { id: 'gpt-4o', name: 'GPT-4o duplicate' },
            ],
          },
        },
      },
    });

    const result = buildProviderAwareModelList(appSettings, []);
    expect(result.filter((m) => m.id === 'gpt-4o')).toHaveLength(1);
  });

  it('keeps a gemini model id that collides with a third-party model id', () => {
    const providers = createDefaultThirdPartyApiSettings().providers;
    const appSettings = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...providers,
          openai: {
            ...providers.openai,
            enabled: true,
            models: [{ id: 'gemini-3-flash', name: 'Gemini via OpenAI' }],
          },
        },
      },
    });

    const result = buildProviderAwareModelList(appSettings, [{ id: 'gemini-3-flash', name: 'Gemini 3 Flash' }]);

    expect(result.filter((m) => m.id === 'gemini-3-flash')).toHaveLength(2);
  });
});
