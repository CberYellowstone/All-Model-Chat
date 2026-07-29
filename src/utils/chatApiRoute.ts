import type { AppSettings, ChatSettings, ThirdPartyProviderConfig, ThirdPartyProviderId } from '@/types';
import { resolveProviderForModelId } from './thirdPartyApiProviders';

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

const getSessionProvider = (appSettings: AppSettings, providerId?: ThirdPartyProviderId) =>
  providerId ? appSettings.thirdPartyApi?.providers[providerId] : undefined;

export const resolveChatApiRoute = (appSettings: AppSettings, chatSettings: ChatSettings): ChatApiRoute => {
  if (chatSettings.apiMode !== 'third-party') {
    return {
      apiMode: 'gemini-native',
      modelId: chatSettings.modelId,
    };
  }

  const selectedModelId = chatSettings.thirdPartyModelId || chatSettings.modelId;
  const sessionProvider = getSessionProvider(appSettings, chatSettings.thirdPartyProviderId);
  if (sessionProvider && chatSettings.thirdPartyProviderId) {
    return {
      apiMode: 'third-party',
      modelId: selectedModelId || sessionProvider.modelId,
      provider: sessionProvider,
      providerId: chatSettings.thirdPartyProviderId,
    };
  }

  const resolvedProvider = resolveProviderForModelId(appSettings, selectedModelId);
  return {
    apiMode: 'third-party',
    modelId: selectedModelId || resolvedProvider.config.modelId,
    provider: resolvedProvider.config,
    providerId: resolvedProvider.id,
  };
};
