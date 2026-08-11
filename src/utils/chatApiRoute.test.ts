import { describe, expect, it } from 'vitest';

import { createAppSettings, createChatSettings } from '@/test/data/factories';
import { createDefaultThirdPartyApiSettings } from './thirdPartyApiProviders';
import { resolveChatApiRoute } from './chatApiRoute';
import { GEMINI_PROVIDER_ID } from '@/types';

describe('resolveChatApiRoute', () => {
  const providers = createDefaultThirdPartyApiSettings().providers;

  const appSettings = createAppSettings({
    thirdPartyApi: {
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
        anthropic: {
          ...providers.anthropic,
          apiKey: 'anthropic-key',
          enabled: true,
          modelId: 'claude-sonnet-5',
        },
      },
    },
  });

  it('routes to gemini-native when providerId is absent and the modelId belongs to no enabled provider', () => {
    const chatSettings = createChatSettings({
      modelId: 'gemini-3.1-pro-preview',
      providerId: undefined,
    });

    expect(resolveChatApiRoute(appSettings, chatSettings)).toEqual({
      apiMode: 'gemini-native',
      modelId: 'gemini-3.1-pro-preview',
    });
  });

  it('routes to gemini-native when providerId is explicitly gemini-native', () => {
    const chatSettings = createChatSettings({
      modelId: 'gemini-3.1-pro-preview',
      providerId: GEMINI_PROVIDER_ID,
    });

    expect(resolveChatApiRoute(appSettings, chatSettings)).toEqual({
      apiMode: 'gemini-native',
      modelId: 'gemini-3.1-pro-preview',
    });
  });

  it('routes to the explicit third-party provider', () => {
    const chatSettings = createChatSettings({
      modelId: 'kimi-k3',
      providerId: 'kimi',
    });

    expect(resolveChatApiRoute(appSettings, chatSettings)).toMatchObject({
      apiMode: 'third-party',
      modelId: 'kimi-k3',
      providerId: 'kimi',
      provider: expect.objectContaining({ apiKey: 'kimi-key' }),
    });
  });

  it('resolves the provider from the modelId when providerId is absent (legacy session)', () => {
    const chatSettings = createChatSettings({
      modelId: 'kimi-k3',
      providerId: undefined,
    });

    expect(resolveChatApiRoute(appSettings, chatSettings)).toMatchObject({
      apiMode: 'third-party',
      modelId: 'kimi-k3',
      providerId: 'kimi',
    });
  });

  it('gemini models win over a colliding third-party id even when providerId is absent', () => {
    // A third-party provider lists a model whose id collides with a Gemini id.
    // The gemini-native default must win when no explicit providerId is set.
    const collidingApp = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...providers,
          openai: {
            ...providers.openai,
            apiKey: 'openai-key',
            enabled: true,
            models: [{ id: 'gemini-3.1-pro-preview', name: 'Gemini via OpenAI' }, ...providers.openai.models],
          },
        },
      },
    });

    expect(
      resolveChatApiRoute(
        collidingApp,
        createChatSettings({ modelId: 'gemini-3.1-pro-preview', providerId: undefined }),
      ),
    ).toEqual({ apiMode: 'gemini-native', modelId: 'gemini-3.1-pro-preview' });

    // An explicit providerId still routes to the third-party provider.
    expect(
      resolveChatApiRoute(
        collidingApp,
        createChatSettings({ modelId: 'gemini-3.1-pro-preview', providerId: 'openai' }),
      ),
    ).toMatchObject({ apiMode: 'third-party', providerId: 'openai' });
  });

  it('falls back to the provider default modelId when the session modelId is empty', () => {
    const chatSettings = createChatSettings({
      modelId: '',
      providerId: 'kimi',
    });

    expect(resolveChatApiRoute(appSettings, chatSettings)).toMatchObject({
      apiMode: 'third-party',
      modelId: 'kimi-k3',
      providerId: 'kimi',
    });
  });

  it('routes to a pinned third-party provider even when the provider is currently disabled', () => {
    // A session that already pinned providerId='kimi' keeps routing there even
    // after the provider toggle is switched off — its models just leave the
    // selector. The explicit providerId is the source of truth for the route.
    const disabledApp = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...providers,
          kimi: {
            ...providers.kimi,
            apiKey: 'kimi-key',
            enabled: false,
            modelId: 'kimi-k3',
          },
        },
      },
    });

    const chatSettings = createChatSettings({
      modelId: 'kimi-k3',
      providerId: 'kimi',
    });

    expect(resolveChatApiRoute(disabledApp, chatSettings)).toMatchObject({
      apiMode: 'third-party',
      modelId: 'kimi-k3',
      providerId: 'kimi',
      provider: expect.objectContaining({ apiKey: 'kimi-key' }),
    });
  });

  it('routes to the explicit provider when two providers share the same model id', () => {
    // Same model id on two enabled providers. The session's explicit providerId
    // must win — this is the regression guard for the header point-to-point pick.
    const sharedModel = 'shared-model';
    const dupApp = createAppSettings({
      thirdPartyApi: {
        providers: {
          ...providers,
          openai: {
            ...providers.openai,
            apiKey: 'openai-key',
            enabled: true,
            models: [{ id: sharedModel, name: 'Shared Model' }],
          },
          kimi: {
            ...providers.kimi,
            apiKey: 'kimi-key',
            enabled: true,
            models: [{ id: sharedModel, name: 'Shared Model (Kimi)' }],
          },
        },
      },
    });

    expect(
      resolveChatApiRoute(dupApp, createChatSettings({ modelId: sharedModel, providerId: 'openai' })),
    ).toMatchObject({
      apiMode: 'third-party',
      providerId: 'openai',
      provider: expect.objectContaining({ apiKey: 'openai-key' }),
    });

    expect(resolveChatApiRoute(dupApp, createChatSettings({ modelId: sharedModel, providerId: 'kimi' }))).toMatchObject(
      { apiMode: 'third-party', providerId: 'kimi', provider: expect.objectContaining({ apiKey: 'kimi-key' }) },
    );
  });
});
