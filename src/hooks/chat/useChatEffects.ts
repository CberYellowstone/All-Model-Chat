import { useEffect, useRef, useState } from 'react';
import { deferToNextTick } from '@/utils/deferToNextTick';
import { type UploadedFile, type SavedChatSession, type ChatSettings } from '@/types';
import { logService } from '@/services/logService';
import { cleanupFilePreviewUrls } from '@/utils/file/filePreviewUrls';
import {
  getModelCapabilities,
  normalizeAspectRatioForModel,
  normalizeImageSizeForModel,
} from '@/utils/model/modelCapabilities';
import { getTranslator } from '@/i18n/translations';

interface UseChatEffectsProps {
  activeSessionId: string | null;
  savedSessions: SavedChatSession[];
  selectedFiles: UploadedFile[];
  appFileError: string | null;
  setAppFileError: React.Dispatch<React.SetStateAction<string | null>>;
  isSwitchingModel: boolean;
  setIsSwitchingModel: (value: boolean) => void;
  currentChatSettings: ChatSettings;
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  imageSize: string;
  setImageSize: (value: string) => void;
  /** Wait for persisted app settings before creating sessions so new chats inherit systemInstruction (e.g. Live Artifacts). */
  isSettingsLoaded: boolean;
  loadInitialData: () => Promise<void>;
  loadChatSession: (id: string) => void;
  startNewChat: () => void;
}

export const useChatEffects = ({
  activeSessionId,
  savedSessions,
  selectedFiles,
  appFileError,
  setAppFileError,
  isSwitchingModel,
  setIsSwitchingModel,
  currentChatSettings,
  aspectRatio,
  setAspectRatio,
  imageSize,
  setImageSize,
  isSettingsLoaded,
  loadInitialData,
  loadChatSession,
  startNewChat,
}: UseChatEffectsProps) => {
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  // Guard against re-running initial load when loadInitialData/startNewChat identities
  // change after the first session write (those callbacks depend on savedSessions).
  const initialLoadStartedRef = useRef(false);
  const loadInitialDataRef = useRef(loadInitialData);
  const loadChatSessionRef = useRef(loadChatSession);
  const startNewChatRef = useRef(startNewChat);
  const recoveringMissingSessionRef = useRef(false);

  loadInitialDataRef.current = loadInitialData;
  loadChatSessionRef.current = loadChatSession;
  startNewChatRef.current = startNewChat;

  useEffect(() => {
    if (!isSettingsLoaded || initialLoadStartedRef.current) {
      return;
    }

    initialLoadStartedRef.current = true;
    void (async () => {
      try {
        await loadInitialDataRef.current();
      } finally {
        setHasLoadedInitialData(true);
      }
    })();
  }, [isSettingsLoaded]);

  useEffect(() => {
    if (!hasLoadedInitialData || !activeSessionId) {
      return;
    }

    if (savedSessions.some((session) => session.id === activeSessionId)) {
      recoveringMissingSessionRef.current = false;
      return;
    }

    if (recoveringMissingSessionRef.current) {
      return;
    }

    recoveringMissingSessionRef.current = true;
    logService.warn(`Active session ${activeSessionId} is no longer available. Switching sessions.`);
    const sortedSessions = [...savedSessions].sort(
      (leftSession, rightSession) => rightSession.timestamp - leftSession.timestamp,
    );
    const nextSession = sortedSessions[0];
    if (nextSession) {
      loadChatSessionRef.current(nextSession.id);
    } else {
      startNewChatRef.current();
    }
  }, [savedSessions, activeSessionId, hasLoadedInitialData]);

  useEffect(() => {
    const handleOnline = () => {
      setAppFileError((currentError) => {
        if (
          currentError &&
          (currentError.toLowerCase().includes('network') || currentError.toLowerCase().includes('fetch'))
        ) {
          logService.info('Network restored, clearing file processing error.');
          return null;
        }
        return currentError;
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [setAppFileError]);

  useEffect(() => {
    const isFileProcessing = selectedFiles.some((file) => file.isProcessing);
    const waitForFilesMessages = [
      getTranslator('en')('messageSenderWaitForFiles'),
      getTranslator('zh')('messageSenderWaitForFiles'),
    ];
    if (appFileError && waitForFilesMessages.includes(appFileError) && !isFileProcessing) {
      setAppFileError(null);
    }
  }, [selectedFiles, appFileError, setAppFileError]);

  const savedSessionsRef = useRef(savedSessions);
  useEffect(() => {
    savedSessionsRef.current = savedSessions;
  }, [savedSessions]);

  useEffect(
    () => () => {
      savedSessionsRef.current.forEach((session) => {
        session.messages.forEach((message) => {
          cleanupFilePreviewUrls(message.files);
        });
      });
    },
    [],
  );

  useEffect(() => {
    if (isSwitchingModel) {
      const timer = deferToNextTick(() => setIsSwitchingModel(false));
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSwitchingModel, setIsSwitchingModel]);

  const prevModelIdRef = useRef(currentChatSettings.modelId);
  useEffect(() => {
    if (prevModelIdRef.current !== currentChatSettings.modelId) {
      const modelId = currentChatSettings.modelId;
      const capabilities = getModelCapabilities(modelId);
      const isBananaModel = capabilities.isFlashImageModel || capabilities.isGemini3ImageModel;

      if (capabilities.supportedAspectRatios?.length) {
        const preferredAspectRatio = isBananaModel ? 'Auto' : aspectRatio;
        const normalizedAspectRatio = normalizeAspectRatioForModel(modelId, preferredAspectRatio);

        if (normalizedAspectRatio && normalizedAspectRatio !== aspectRatio) {
          setAspectRatio(normalizedAspectRatio);
        }
      } else if (aspectRatio === 'Auto') {
        setAspectRatio('1:1');
      }

      const normalizedImageSize = normalizeImageSizeForModel(modelId, imageSize);
      if (normalizedImageSize && normalizedImageSize !== imageSize) {
        setImageSize(normalizedImageSize);
      }

      prevModelIdRef.current = modelId;
    }
  }, [currentChatSettings.modelId, aspectRatio, imageSize, setAspectRatio, setImageSize]);
};
