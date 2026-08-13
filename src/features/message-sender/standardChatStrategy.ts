import { logService } from '@/services/logService';
import { buildContentParts } from '@/utils/chat/builder';
import { isServerCodeExecutionMode } from '@/utils/codeExecution';
import { getModelCapabilities } from '@/utils/model/modelCapabilities';
import { resolveChatApiRoute } from '@/utils/chatApiRoute';
import type { UploadedFile } from '@/types';
import { runOptimisticMessagePipeline, type MessageLifecycleRunner } from './messagePipeline';
import { resolveStandardChatTurn } from './standardChatTurn';
import { performStandardChatApiCall } from './standardChatApiCall';
import type { GetStreamHandlers, StandardChatProps } from './messageSenderTypes';
import type { PreparedModelRequest } from './useModelRequestRunner';

interface SendStandardMessageParams {
  props: Omit<StandardChatProps, 'getStreamHandlers'>;
  getStreamHandlers: GetStreamHandlers;
  runMessageLifecycle: MessageLifecycleRunner;
  text: string;
  files: UploadedFile[];
  editingMessageId: string | null;
  activeModelId: string;
  isContinueMode?: boolean;
  isFastMode?: boolean;
  request: PreparedModelRequest;
}

export const sendStandardMessage = async ({
  props,
  getStreamHandlers,
  runMessageLifecycle,
  text: textToUse,
  files: filesToUse,
  editingMessageId: effectiveEditingId,
  activeModelId,
  isContinueMode = false,
  isFastMode = false,
  request,
}: SendStandardMessageParams) => {
  const {
    appSettings,
    currentChatSettings,
    messages,
    setEditingMessageId,
    aspectRatio,
    imageSize,
    imageOutputMode,
    personGeneration,
    userScrolledUpRef,
    activeSessionId,
    setActiveSessionId,
    updateAndPersistSessions,
    sessionKeyMapRef,
  } = props;
  const effectiveActiveModelId = resolveChatApiRoute(appSettings, currentChatSettings).modelId || activeModelId;
  const settingsForPersistence = { ...currentChatSettings };
  const settingsForApi = { ...currentChatSettings };

  if (isFastMode) {
    const capabilities = getModelCapabilities(effectiveActiveModelId);
    const targetLevel = capabilities.isGemini3FlashModel ? 'MINIMAL' : 'LOW';

    settingsForApi.thinkingLevel = targetLevel;
    settingsForApi.thinkingBudget = 0;
    logService.info(`Fast Mode activated (One-off): Overriding thinking level to ${targetLevel}.`);
  }

  const { keyToUse, shouldLockKey, generationId, generationStartTime, abortController: newAbortController } = request;

  const successfullyProcessedFiles = filesToUse.filter(
    (file) => file.uploadState === 'active' && !file.error && !file.isProcessing,
  );
  const preferCodeExecutionFileInputs = isServerCodeExecutionMode(settingsForApi);

  const { contentParts: promptParts, enrichedFiles } = await buildContentParts(
    textToUse.trim(),
    successfullyProcessedFiles,
    effectiveActiveModelId,
    settingsForApi.mediaResolution,
    preferCodeExecutionFileInputs,
  );

  // Gemini 3.6+ rejects prefilled model turns (HTTP 400). Raw mode ends the payload with a
  // model role `<thinking>` prefix, so it is unsafe for those models even if listed as raw-capable.
  const modelIdLower = effectiveActiveModelId.toLowerCase();
  const bansModelTurnPrefill =
    /gemini-3\.[6-9]/.test(modelIdLower) ||
    modelIdLower.includes('gemini-3.5-flash-lite') ||
    /gemini-[4-9]/.test(modelIdLower);
  const isRawMode = Boolean(
    (settingsForApi.isRawModeEnabled ?? appSettings.isRawModeEnabled) &&
    !isContinueMode &&
    !bansModelTurnPrefill &&
    getModelCapabilities(effectiveActiveModelId).supportsRawReasoningPrefill,
  );

  const lastMessage = messages[messages.length - 1];
  const cumulativeTotalTokens = lastMessage?.cumulativeTotalTokens || 0;
  const placement =
    isContinueMode && effectiveEditingId
      ? ({ type: 'continue-model', targetMessageId: effectiveEditingId } as const)
      : ({ type: 'append-turn' } as const);

  await runOptimisticMessagePipeline({
    activeSessionId,
    appSettings,
    currentChatSettings: settingsForPersistence,
    updateAndPersistSessions,
    setActiveSessionId,
    text: textToUse.trim(),
    files: enrichedFiles.length ? enrichedFiles : undefined,
    generationId,
    generationStartTime,
    editingMessageId: effectiveEditingId,
    shouldGenerateTitle: (session) => !activeSessionId || session?.title === 'New Chat',
    shouldLockKey,
    keyToLock: keyToUse,
    abortController: newAbortController,
    errorPrefix: 'Error',
    runMessageLifecycle,
    placement,
    userMessageOptions: {
      cumulativeTotalTokens: cumulativeTotalTokens > 0 ? cumulativeTotalTokens : undefined,
    },
    modelMessageOptions: {
      content: isRawMode ? '<thinking>' : '',
    },
    afterStart: (turn) => {
      userScrolledUpRef.current = false;
      sessionKeyMapRef.current.set(turn.finalSessionId, keyToUse);
      if (effectiveEditingId) {
        setEditingMessageId(null);
      }
    },
    execute: async (turn) => {
      await performStandardChatApiCall({
        appSettings,
        messages,
        updateAndPersistSessions,
        getStreamHandlers,
        aspectRatio,
        imageSize,
        imageOutputMode,
        personGeneration,
        resolveTurn: resolveStandardChatTurn,
        finalSessionId: turn.finalSessionId,
        generationId,
        generationStartTime,
        keyToUse,
        activeModelId: effectiveActiveModelId,
        promptParts,
        effectiveEditingId,
        isContinueMode,
        isRawMode,
        sessionToUpdate: settingsForApi,
        newAbortController,
        textToUse,
        enrichedFiles,
      });
    },
  });
};
