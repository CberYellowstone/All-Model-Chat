import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import type { ThirdPartyProviderId } from '@/types';
import { getEnabledThirdPartyProviders } from '@/utils/thirdPartyApiProviders';
import { resolveChatApiRoute } from '@/utils/chatApiRoute';
import { buildNewTabHref } from '@/utils/chat/lastActiveSession';
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
  const geminiModels = apiModels.map((model) => ({ ...model, apiMode: 'gemini-native' as const }));
  // Third-party models show in the header whenever their provider is enabled —
  // picking one routes the session to that provider. Same-named ids from
  // different providers are all kept (the picker groups them per provider), so
  // a model that exists on two providers stays selectable on both.
  const thirdPartyModels = getEnabledThirdPartyProviders(appSettings).flatMap(({ id, config }) =>
    config.models.map((model) => ({
      ...model,
      apiMode: 'third-party' as const,
      providerId: id,
    })),
  );

  return [...geminiModels, ...thirdPartyModels];
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

  // Destructure the chatState members into stable local references so the
  // callbacks and memo below are not invalidated by the whole chatState object
  // changing identity on every render (see inputRuntimeValues.ts for details).
  const {
    currentChatSettings,
    apiModels,
    isAppDraggingOver,
    modelsLoadingError,
    handleAppDragEnter,
    handleAppDragOver,
    handleAppDragLeave,
    handleAppDrop,
    startNewChat,
    activeSessionId,
    handleSelectModelInHeader,
    setCurrentChatSettings,
  } = chatState;

  const gemmaReasoningEnabled = currentChatSettings.showThoughts;
  const onToggleGemmaReasoning = useCallback(() => {
    const nextGemmaReasoningEnabled = !gemmaReasoningEnabled;

    setAppSettings((prev) => ({
      ...prev,
      showThoughts: nextGemmaReasoningEnabled,
    }));

    setCurrentChatSettings((prev) => ({
      ...prev,
      showThoughts: nextGemmaReasoningEnabled,
    }));
  }, [gemmaReasoningEnabled, setAppSettings, setCurrentChatSettings]);

  const currentModelName = getCurrentModelDisplayName();
  const currentApiRoute = resolveChatApiRoute(appSettings, currentChatSettings);
  const headerAvailableModels = useMemo(() => buildHeaderModels(appSettings, apiModels), [appSettings, apiModels]);
  const headerSelectedModelId = currentApiRoute.modelId;
  // Picking a model only affects the active session's (providerId, modelId) —
  // it no longer flips a global apiMode/isThirdPartyApiEnabled.
  const handleHeaderSelectModel = useCallback(
    (modelId: string, providerId?: ThirdPartyProviderId) => {
      handleSelectModelInHeader(modelId, providerId);
    },
    [handleSelectModelInHeader],
  );

  const header = useMemo<ChatHeaderRuntimeValue>(
    () => ({
      isAppDraggingOver,
      modelsLoadingError,
      handleAppDragEnter,
      handleAppDragOver,
      handleAppDragLeave,
      handleAppDrop,
      currentModelName,
      availableModels: headerAvailableModels,
      selectedModelId: headerSelectedModelId,
      isLiveArtifactsPromptActive,
      isLiveArtifactsPromptBusy: !!isLiveArtifactsPromptBusy,
      isPipSupported: pipState.isPipSupported,
      isPipActive: pipState.isPipActive,
      onNewChat: startNewChat,
      newChatHref: buildNewTabHref(activeSessionId),
      onOpenScenariosModal,
      onToggleHistorySidebar,
      onLoadLiveArtifactsPrompt: handleLoadLiveArtifactsPromptAndSave,
      onSelectModel: handleHeaderSelectModel,
      onSetThinkingLevel: handleSetThinkingLevel,
      onToggleGemmaReasoning,
      onTogglePip: pipState.togglePip,
    }),
    [
      activeSessionId,
      currentModelName,
      handleAppDragEnter,
      handleAppDragLeave,
      handleAppDragOver,
      handleAppDrop,
      handleHeaderSelectModel,
      handleLoadLiveArtifactsPromptAndSave,
      handleSetThinkingLevel,
      headerAvailableModels,
      headerSelectedModelId,
      isAppDraggingOver,
      isLiveArtifactsPromptActive,
      isLiveArtifactsPromptBusy,
      modelsLoadingError,
      onOpenScenariosModal,
      onToggleGemmaReasoning,
      onToggleHistorySidebar,
      pipState.isPipActive,
      pipState.isPipSupported,
      pipState.togglePip,
      startNewChat,
    ],
  );

  return {
    header,
    headerAvailableModels,
    handleHeaderSelectModel,
  };
};
