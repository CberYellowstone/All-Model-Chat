import { type MutableRefObject, useCallback } from 'react';
import { type AppSettings, type ChatSettings as IndividualChatSettings, type SavedChatSession } from '@/types';
import { DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import { createNewSession } from '@/utils/chat/session';
import { focusChatInput } from '@/utils/chat-input/focus';
import { resolveModelSwitchSettings } from '@/utils/model/modelSwitchSettings';
import { getEnabledThirdPartyProviders, resolveProviderForModelId } from '@/utils/thirdPartyApiProviders';

interface UseModelSelectionProps {
  appSettings: AppSettings;
  activeSessionId: string | null;
  currentChatSettings: IndividualChatSettings;
  isLoading: boolean;
  updateAndPersistSessions: (
    updater: (prev: SavedChatSession[]) => SavedChatSession[],
    options?: { persist?: boolean },
  ) => void;
  setActiveSessionId: (id: string | null) => void;
  setCurrentChatSettings: (updater: (prevSettings: IndividualChatSettings) => IndividualChatSettings) => void;
  setIsSwitchingModel: (switching: boolean) => void;
  handleStopGenerating: () => void;
  userScrolledUpRef: MutableRefObject<boolean>;
}

const hasResolvedModelSettingChanges = (
  currentSettings: IndividualChatSettings,
  resolvedModelSettings: Partial<IndividualChatSettings>,
): boolean =>
  currentSettings.thinkingBudget !== resolvedModelSettings.thinkingBudget ||
  currentSettings.thinkingLevel !== resolvedModelSettings.thinkingLevel;

export const useModelSelection = ({
  appSettings,
  activeSessionId,
  currentChatSettings,
  isLoading,
  updateAndPersistSessions,
  setActiveSessionId,
  setCurrentChatSettings,
  setIsSwitchingModel,
  handleStopGenerating,
  userScrolledUpRef,
}: UseModelSelectionProps) => {
  const handleSelectModelInHeader = useCallback(
    (modelId: string) => {
      const thirdPartyModels = getEnabledThirdPartyProviders(appSettings);
      const isThirdPartyModel = thirdPartyModels.some(({ config }) => config.models.some((m) => m.id === modelId));
      const provider = isThirdPartyModel ? resolveProviderForModelId(appSettings, modelId) : undefined;
      const sourceSettings = activeSessionId ? currentChatSettings : appSettings;
      const resolvedModelSettings: Partial<IndividualChatSettings> = resolveModelSwitchSettings({
        currentSettings: currentChatSettings,
        sourceSettings,
        targetModelId: modelId,
      });
      const routingSettings: Pick<IndividualChatSettings, 'apiMode' | 'thirdPartyProviderId' | 'thirdPartyModelId'> =
        isThirdPartyModel && provider
          ? {
              apiMode: 'third-party',
              thirdPartyProviderId: provider.id,
              thirdPartyModelId: modelId,
            }
          : {
              apiMode: 'gemini-native',
              thirdPartyProviderId: undefined,
              thirdPartyModelId: undefined,
            };
      const nextModelSettings = { ...resolvedModelSettings, ...routingSettings };

      if (!activeSessionId) {
        const sessionSettings = { ...DEFAULT_CHAT_SETTINGS, ...appSettings, ...nextModelSettings };
        const newSession = createNewSession(sessionSettings);

        updateAndPersistSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      } else {
        if (isLoading) handleStopGenerating();
        if (modelId !== currentChatSettings.modelId) {
          setIsSwitchingModel(true);
          updateAndPersistSessions((prev) =>
            prev.map((session) =>
              session.id === activeSessionId
                ? { ...session, settings: { ...session.settings, ...nextModelSettings } }
                : session,
            ),
          );
        } else {
          const routingChanged =
            currentChatSettings.apiMode !== routingSettings.apiMode ||
            currentChatSettings.thirdPartyProviderId !== routingSettings.thirdPartyProviderId ||
            currentChatSettings.thirdPartyModelId !== routingSettings.thirdPartyModelId;
          if (routingChanged || hasResolvedModelSettingChanges(currentChatSettings, resolvedModelSettings)) {
            setCurrentChatSettings((prev) => ({
              ...prev,
              ...nextModelSettings,
            }));
          }
        }
      }

      userScrolledUpRef.current = false;
      focusChatInput();
    },
    [
      isLoading,
      currentChatSettings,
      updateAndPersistSessions,
      activeSessionId,
      userScrolledUpRef,
      handleStopGenerating,
      appSettings,
      setActiveSessionId,
      setCurrentChatSettings,
      setIsSwitchingModel,
    ],
  );

  return { handleSelectModelInHeader };
};
