import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import type { ThirdPartyProviderId } from '@/types';
import { getEnabledThirdPartyProviders } from '@/utils/thirdPartyApiProviders';
import { resolveChatApiRoute } from '@/utils/chatApiRoute';
import { isThirdPartyApiActive } from '@/utils/thirdPartyApiActive';
import type { ChatHeaderRuntimeValue } from './chatRuntimeTypes';

interface HeaderRuntimeValuesOptions {
  app: AppViewModel;
  onOpenScenariosModal: () => void;
  onToggleHistorySidebar: () => void;
}

const buildHeaderModels = (
  appSettings: AppViewModel['appSettings'],
  apiModels: AppViewModel['chatState']['apiModels'],
) => {
  const seenIds = new Set<string>();
  const geminiModels = apiModels.map((model) => ({ ...model, apiMode: 'gemini-native' as const }));
  // Third-party models show in the header whenever their provider is enabled,
  // regardless of the top-level apiMode selector — picking one switches modes.
  const thirdPartyModels = getEnabledThirdPartyProviders(appSettings).flatMap(({ id, config }) =>
    config.models.map((model) => ({
      ...model,
      apiMode: 'third-party' as const,
      providerId: id,
    })),
  );

  return [...geminiModels, ...thirdPartyModels].filter((model) => {
    if (seenIds.has(model.id)) {
      return false;
    }

    seenIds.add(model.id);
    return true;
  });
};

export const useChatHeaderRuntimeValues = ({
  app,
  onOpenScenariosModal,
  onToggleHistorySidebar,
}: HeaderRuntimeValuesOptions) => {
  const {
    appSettings,
    setAppSettings,
    chatState,
    pipState,
    handleLoadLiveArtifactsPromptAndSave,
    isLiveArtifactsPromptActive,
    isLiveArtifactsPromptBusy,
    handleSetThinkingLevel,
    getCurrentModelDisplayName,
  } = app;

  const gemmaReasoningEnabled = chatState.currentChatSettings.showThoughts;
  const onToggleGemmaReasoning = useCallback(() => {
    const nextGemmaReasoningEnabled = !gemmaReasoningEnabled;

    setAppSettings((prev) => ({
      ...prev,
      showThoughts: nextGemmaReasoningEnabled,
    }));

    chatState.setCurrentChatSettings((prev) => ({
      ...prev,
      showThoughts: nextGemmaReasoningEnabled,
    }));
  }, [chatState, gemmaReasoningEnabled, setAppSettings]);

  const currentModelName = getCurrentModelDisplayName();
  const currentApiRoute = resolveChatApiRoute(appSettings, chatState.currentChatSettings);
  const isOpenAICompatibleMode = currentApiRoute.apiMode === 'third-party';
  const isGlobalThirdPartyMode = isThirdPartyApiActive(appSettings);
  // Map of modelId → providerId for all enabled third-party models.
  const thirdPartyModelProviders = useMemo(() => {
    const map = new Map<string, string>();
    getEnabledThirdPartyProviders(appSettings).forEach(({ id, config }) => {
      config.models.forEach((model) => {
        if (!map.has(model.id)) {
          map.set(model.id, id);
        }
      });
    });
    return map;
  }, [appSettings]);
  const thirdPartyModelIds = useMemo(() => new Set(thirdPartyModelProviders.keys()), [thirdPartyModelProviders]);
  const geminiModelIds = useMemo(() => new Set(chatState.apiModels.map((model) => model.id)), [chatState.apiModels]);
  const headerAvailableModels = useMemo(
    () => buildHeaderModels(appSettings, chatState.apiModels),
    [appSettings, chatState.apiModels],
  );
  const headerSelectedModelId = currentApiRoute.modelId;
  const handleHeaderSelectModel = useCallback(
    (modelId: string) => {
      const isThirdPartyModel = thirdPartyModelIds.has(modelId);
      const isGeminiModel = geminiModelIds.has(modelId);

      if (isThirdPartyModel && (!isGeminiModel || isOpenAICompatibleMode)) {
        const providerId = thirdPartyModelProviders.get(modelId) as ThirdPartyProviderId | undefined;
        if (providerId) {
          setAppSettings((prev) => ({
            ...prev,
            isThirdPartyApiEnabled: true,
            apiMode: 'third-party',
            thirdPartyApi: {
              ...prev.thirdPartyApi,
              activeProvider: providerId,
            },
          }));
        }
        chatState.handleSelectModelInHeader(modelId);
        return;
      }

      if (isGlobalThirdPartyMode) {
        setAppSettings((prev) => ({
          ...prev,
          apiMode: 'gemini-native',
        }));
      }
      chatState.handleSelectModelInHeader(modelId);
    },
    [
      chatState,
      geminiModelIds,
      isGlobalThirdPartyMode,
      isOpenAICompatibleMode,
      thirdPartyModelIds,
      thirdPartyModelProviders,
      setAppSettings,
    ],
  );

  const header = useMemo<ChatHeaderRuntimeValue>(
    () => ({
      isAppDraggingOver: chatState.isAppDraggingOver,
      modelsLoadingError: chatState.modelsLoadingError,
      handleAppDragEnter: chatState.handleAppDragEnter,
      handleAppDragOver: chatState.handleAppDragOver,
      handleAppDragLeave: chatState.handleAppDragLeave,
      handleAppDrop: chatState.handleAppDrop,
      currentModelName,
      availableModels: headerAvailableModels,
      selectedModelId: headerSelectedModelId,
      isLiveArtifactsPromptActive,
      isLiveArtifactsPromptBusy: !!isLiveArtifactsPromptBusy,
      isPipSupported: pipState.isPipSupported,
      isPipActive: pipState.isPipActive,
      onNewChat: chatState.startNewChat,
      onOpenScenariosModal,
      onToggleHistorySidebar,
      onLoadLiveArtifactsPrompt: handleLoadLiveArtifactsPromptAndSave,
      onSelectModel: handleHeaderSelectModel,
      onSetThinkingLevel: handleSetThinkingLevel,
      onToggleGemmaReasoning,
      onTogglePip: pipState.togglePip,
    }),
    [
      chatState,
      currentModelName,
      handleHeaderSelectModel,
      handleLoadLiveArtifactsPromptAndSave,
      handleSetThinkingLevel,
      headerAvailableModels,
      headerSelectedModelId,
      isLiveArtifactsPromptActive,
      isLiveArtifactsPromptBusy,
      onOpenScenariosModal,
      onToggleGemmaReasoning,
      onToggleHistorySidebar,
      pipState,
    ],
  );

  return {
    header,
    headerAvailableModels,
    handleHeaderSelectModel,
  };
};
