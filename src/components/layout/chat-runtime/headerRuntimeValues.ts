import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import { getEnabledThirdPartyProviders } from '@/utils/thirdPartyApiProviders';
import { resolveChatApiRoute } from '@/utils/chatApiRoute';
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
  // Third-party models show in the header whenever their provider is enabled —
  // picking one routes the session to that provider.
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
  const headerAvailableModels = useMemo(
    () => buildHeaderModels(appSettings, chatState.apiModels),
    [appSettings, chatState.apiModels],
  );
  const headerSelectedModelId = currentApiRoute.modelId;
  // Picking a model only affects the active session's (providerId, modelId) —
  // it no longer flips a global apiMode/isThirdPartyApiEnabled/activeProvider.
  const handleHeaderSelectModel = useCallback(
    (modelId: string) => {
      chatState.handleSelectModelInHeader(modelId);
    },
    [chatState],
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
