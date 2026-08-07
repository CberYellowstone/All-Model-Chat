import {
  type AppSettings,
  type ChatSettings,
  type ThirdPartyProviderConfig,
  type ThirdPartyProviderId,
  GEMINI_PROVIDER_ID,
} from '@/types';
import { getEnabledThirdPartyProviders } from './thirdPartyApiProviders';
export type ChatApiRoute =
  | {
      apiMode: 'gemini-native';
      modelId: string;
      provider?: undefined;
      providerId?: undefined;
    }
  | {
      apiMode: 'third-party';
      modelId: string;
      provider: ThirdPartyProviderConfig;
      providerId: ThirdPartyProviderId;
    };

// Find the enabled provider whose models list contains this modelId, scanning
// providers in fixed ID order (see getEnabledThirdPartyProviders). Returns
// undefined when the modelId belongs to no enabled provider.
const findProviderForModelId = (
  appSettings: AppSettings,
  modelId: string,
): { id: ThirdPartyProviderId; config: ThirdPartyProviderConfig } | undefined => {
  for (const { id, config } of getEnabledThirdPartyProviders(appSettings)) {
    if (config.models.some((model) => model.id === modelId)) {
      return { id, config };
    }
  }
  return undefined;
};

// A modelId that looks like a Gemini-family id is treated as Gemini when no
// explicit providerId pins it — so an enabled third-party provider that (by
// mistake) lists a model id matching a real Gemini model cannot shadow it.
const isGeminiFamilyModelId = (modelId: string): boolean =>
  modelId.toLowerCase().includes('gemini') || modelId.toLowerCase().includes('gemma');

/**
 * Resolve which API a session actually talks to, from the session's stored
 * `(providerId, modelId)` composite key — the single source of truth. The
 * explicit `providerId` wins over any global mode setting; absent or
 * 'gemini-native' means Gemini, except when the modelId itself resolves to an
 * enabled third-party provider (a legacy session whose providerId was not
 * backfilled). When `geminiModelIds` is supplied (the live Gemini model list),
 * Gemini models win over a colliding third-party id for the no-providerId
 * fallback, per the resolution order "Gemini list first, then providers".
 */
export const resolveChatApiRoute = (
  appSettings: AppSettings,
  chatSettings: ChatSettings,
  geminiModelIds?: Set<string>,
): ChatApiRoute => {
  const { modelId, providerId } = chatSettings;

  if (providerId && providerId !== GEMINI_PROVIDER_ID) {
    const provider = appSettings.thirdPartyApi?.providers[providerId];
    if (provider) {
      return {
        apiMode: 'third-party',
        modelId: modelId || provider.modelId,
        provider,
        providerId,
      };
    }
    // Explicit third-party id with a missing config (shouldn't survive
    // sanitize) — fall through and treat the modelId as the source of truth.
  }

  if (!providerId) {
    const isGemini = geminiModelIds ? geminiModelIds.has(modelId) : isGeminiFamilyModelId(modelId);
    if (!isGemini) {
      const resolved = findProviderForModelId(appSettings, modelId);
      if (resolved) {
        return {
          apiMode: 'third-party',
          modelId,
          provider: resolved.config,
          providerId: resolved.id,
        };
      }
    }
  }

  return {
    apiMode: 'gemini-native',
    modelId,
  };
};

/** True when the session routes to a third-party provider. */
export const isThirdPartyApiRoute = (appSettings: AppSettings, chatSettings: ChatSettings): boolean =>
  resolveChatApiRoute(appSettings, chatSettings).apiMode === 'third-party';
