import { createChatHistoryForApi } from '@/utils/chat/builder';
import { toError } from '@/utils/errorMessage';
import { createMessage } from '@/utils/chat/session';
import { isServerCodeExecutionMode } from '@/utils/codeExecution';
import {
  isGemini3Model,
  isImageGenerationModel,
  shouldStripThinkingFromContext,
} from '@/utils/model/modelCapabilities';
import { appendFunctionDeclarationsToTools, buildGenerationConfig } from '@/services/api/generationConfig';
import {
  generateContentTurnApi,
  sendStatelessMessageNonStreamApi,
  sendStatelessMessageStreamApi,
} from '@/services/api/chatApi';
import {
  sendOpenAICompatibleMessageNonStream,
  sendOpenAICompatibleMessageStream,
} from '@/services/api/openaiCompatibleApi';
import { sendAnthropicMessageNonStream, sendAnthropicMessageStream } from '@/services/api/anthropicApi';
import { createMcpClientFunctions } from '@/features/mcp/mcpClientFunctions';
import { createStandardClientFunctions } from '@/features/standard-chat/standardClientFunctions';
import { runStandardToolLoop } from '@/features/standard-chat/standardToolLoop';
import { collectLocalPythonInputFiles } from '@/features/local-python/executionFiles';
import { getPyodideService } from '@/features/local-python/loadPyodideService';
import { updateSessionById } from '@/utils/chat/sessionMutations';
import {
  recordPendingStreamJob,
  advancePendingStreamJobSeq,
  clearPendingStreamJob,
} from '@/features/stream-jobs/amcStreamJobs';
import { isGeminiProxyRelativePath } from '@/services/api/geminiApiBaseUrl';
import type {
  ChatMessage,
  ChatSettings as IndividualChatSettings,
  NonStreamMessageCompleteHandler,
  UploadedFile,
} from '@/types';
import type { ContentPart } from '@/types/chat';
import type {
  GetStreamHandlers,
  SessionsUpdater,
  StandardChatProps,
  StreamHandlerFunctions,
} from './messageSenderTypes';
import type { resolveStandardChatTurn } from './standardChatTurn';
import { resolveChatApiRoute } from '@/utils/chatApiRoute';

interface StandardChatApiCallContext {
  appSettings: StandardChatProps['appSettings'];
  messages: ChatMessage[];
  updateAndPersistSessions: SessionsUpdater;
  getStreamHandlers: GetStreamHandlers;
  aspectRatio: string;
  imageSize?: string;
  imageOutputMode: StandardChatProps['imageOutputMode'];
  personGeneration: StandardChatProps['personGeneration'];
  resolveTurn: typeof resolveStandardChatTurn;
}

interface PerformStandardChatApiCallParams extends StandardChatApiCallContext {
  finalSessionId: string;
  generationId: string;
  generationStartTime: Date;
  keyToUse: string;
  activeModelId: string;
  promptParts: ContentPart[];
  effectiveEditingId: string | null;
  isContinueMode: boolean;
  isRawMode: boolean;
  sessionToUpdate: IndividualChatSettings;
  newAbortController: AbortController;
  textToUse: string;
  enrichedFiles: UploadedFile[];
}

const routeThrownStreamError = async (run: () => Promise<void>, streamOnError: (error: Error) => void) => {
  try {
    await run();
  } catch (error) {
    streamOnError(toError(error));
  }
};

const createNonStreamCompleteHandler =
  ({
    streamOnPart,
    onThoughtChunk,
    streamOnComplete,
  }: Pick<
    StreamHandlerFunctions,
    'streamOnPart' | 'onThoughtChunk' | 'streamOnComplete'
  >): NonStreamMessageCompleteHandler =>
  (parts, thoughts, usage, grounding, urlContext) => {
    for (const part of parts) {
      streamOnPart(part, { recordFirstToken: false });
    }
    if (thoughts) {
      onThoughtChunk(thoughts, { recordFirstToken: false });
    }
    streamOnComplete(usage, grounding, urlContext);
  };

export const performStandardChatApiCall = async ({
  appSettings,
  messages,
  updateAndPersistSessions,
  getStreamHandlers,
  aspectRatio,
  imageSize,
  imageOutputMode,
  personGeneration,
  resolveTurn,
  finalSessionId,
  generationId,
  generationStartTime,
  keyToUse,
  activeModelId,
  promptParts,
  effectiveEditingId,
  isContinueMode,
  isRawMode,
  sessionToUpdate,
  newAbortController,
  textToUse,
  enrichedFiles,
}: PerformStandardChatApiCallParams) => {
  const apiRoute = resolveChatApiRoute(appSettings, sessionToUpdate);
  const activeProvider = apiRoute.provider ?? null;
  const apiModelId = apiRoute.modelId || activeModelId;
  const { baseMessagesForApi, finalRole, finalParts, shouldSkipApiCall } = resolveTurn({
    messages,
    promptParts,
    textToUse,
    enrichedFiles,
    effectiveEditingId,
    isContinueMode,
    isRawMode,
    apiModelId,
  });

  if (shouldSkipApiCall) {
    return;
  }

  const alwaysKeepThinking =
    sessionToUpdate.alwaysKeepThinkingInContext ?? appSettings.alwaysKeepThinkingInContext ?? false;
  const shouldStripThinking = shouldStripThinkingFromContext(
    apiModelId,
    sessionToUpdate.hideThinkingInContext ?? appSettings.hideThinkingInContext,
    alwaysKeepThinking,
  );
  const historyForChat = await createChatHistoryForApi(
    baseMessagesForApi,
    shouldStripThinking,
    apiModelId,
    isServerCodeExecutionMode(sessionToUpdate),
    alwaysKeepThinking,
  );

  const { streamOnError, streamOnComplete, streamOnPart, onThoughtChunk } = getStreamHandlers(
    finalSessionId,
    generationId,
    newAbortController,
    generationStartTime,
    sessionToUpdate,
    finalParts,
  );
  const wrappedStreamOnComplete: typeof streamOnComplete = (usage, grounding, urlContext) => {
    clearPendingStreamJob(finalSessionId);
    streamOnComplete(usage, grounding, urlContext);
  };
  const nonStreamOnComplete = createNonStreamCompleteHandler({
    streamOnPart,
    onThoughtChunk,
    streamOnComplete: wrappedStreamOnComplete,
  });

  if (activeProvider) {
    const providerConfig = {
      baseUrl: activeProvider.baseUrl,
      systemInstruction: sessionToUpdate.systemInstruction,
      temperature: sessionToUpdate.temperature,
      topP: sessionToUpdate.topP,
      thinkingLevel: sessionToUpdate.thinkingLevel,
      thinkingBudget: sessionToUpdate.thinkingBudget,
    };
    const isAnthropic = activeProvider.protocol === 'anthropic';
    // Tagged so the api container's third-party proxy can route to the right
    // upstream in THIRD_PARTY_ROUTES. Null in static deploys (no proxy).
    const providerId = apiRoute.providerId ?? null;

    if (appSettings.isStreamingEnabled) {
      await routeThrownStreamError(
        () =>
          isAnthropic
            ? sendAnthropicMessageStream(
                keyToUse,
                apiModelId,
                historyForChat,
                finalParts,
                providerConfig,
                newAbortController.signal,
                streamOnPart,
                onThoughtChunk,
                streamOnError,
                streamOnComplete,
                finalRole,
                providerId,
              )
            : sendOpenAICompatibleMessageStream(
                keyToUse,
                apiModelId,
                historyForChat,
                finalParts,
                providerConfig,
                newAbortController.signal,
                streamOnPart,
                onThoughtChunk,
                streamOnError,
                streamOnComplete,
                finalRole,
                providerId,
              ),
        streamOnError,
      );
      return;
    }

    await routeThrownStreamError(
      () =>
        isAnthropic
          ? sendAnthropicMessageNonStream(
              keyToUse,
              apiModelId,
              historyForChat,
              finalParts,
              providerConfig,
              newAbortController.signal,
              streamOnError,
              nonStreamOnComplete,
              finalRole,
              providerId,
            )
          : sendOpenAICompatibleMessageNonStream(
              keyToUse,
              apiModelId,
              historyForChat,
              finalParts,
              providerConfig,
              newAbortController.signal,
              streamOnError,
              nonStreamOnComplete,
              finalRole,
              providerId,
            ),
      streamOnError,
    );
    return;
  }

  const localPythonContextMessages =
    finalRole === 'user'
      ? [
          ...baseMessagesForApi,
          {
            id: 'temp-standard-user',
            role: 'user' as const,
            content: textToUse.trim(),
            files: enrichedFiles,
            timestamp: new Date(),
          },
        ]
      : baseMessagesForApi;
  const standardClientFunctions = createStandardClientFunctions({
    isLocalPythonEnabled:
      !!sessionToUpdate.isLocalPythonEnabled &&
      finalRole === 'user' &&
      !isRawMode &&
      !isImageGenerationModel(apiModelId),
    inputFiles: collectLocalPythonInputFiles(
      [
        ...localPythonContextMessages,
        {
          id: 'temp-standard-tool-target',
          role: 'model',
          content: '',
          timestamp: new Date(),
        },
      ],
      'temp-standard-tool-target',
    ),
    runPython: async (code, options) => {
      const pyodideService = await getPyodideService();
      return pyodideService.runPython(code, options);
    },
  });
  const enabledMcpServers = (appSettings.mcpServers ?? []).filter((server) => server.enabled);
  const isMcpEnabledForTurn =
    finalRole === 'user' && !isRawMode && !isImageGenerationModel(apiModelId) && enabledMcpServers.length > 0;
  // Discovery is resilient: failures log and yield {} so chat continues without MCP tools.
  const mcpClientFunctions = isMcpEnabledForTurn
    ? await createMcpClientFunctions({
        servers: enabledMcpServers,
        abortSignal: newAbortController.signal,
      })
    : {};
  const combinedClientFunctions = {
    ...standardClientFunctions,
    ...mcpClientFunctions,
  };
  const localPythonFunctionDeclarations = Object.values(standardClientFunctions).map(({ declaration }) => declaration);
  const mcpFunctionDeclarations = Object.values(mcpClientFunctions).map(({ declaration }) => declaration);
  const hasRequestedServerSideToolThatNeedsCombination =
    !!sessionToUpdate.isGoogleSearchEnabled ||
    !!sessionToUpdate.isGoogleMapsEnabled ||
    !!sessionToUpdate.isDeepSearchEnabled ||
    !!sessionToUpdate.isUrlContextEnabled;
  const isLocalPythonEnabledForTurn =
    localPythonFunctionDeclarations.length > 0 &&
    (isGemini3Model(apiModelId) || !hasRequestedServerSideToolThatNeedsCombination);

  const config = await buildGenerationConfig({
    settings: sessionToUpdate,
    modelId: apiModelId,
    aspectRatio,
    imageSize,
    isLocalPythonEnabled: isLocalPythonEnabledForTurn,
    imageOutputMode,
    personGeneration,
  });

  const requestConfig = appendFunctionDeclarationsToTools(apiModelId, config, [
    ...(isLocalPythonEnabledForTurn ? localPythonFunctionDeclarations : []),
    ...mcpFunctionDeclarations,
  ]);
  const hasFunctionDeclarationsInRequest = !!requestConfig.tools?.some((tool) => 'functionDeclarations' in tool);

  if (hasFunctionDeclarationsInRequest) {
    try {
      const toolLoopResult = await runStandardToolLoop({
        initialContents: [...historyForChat, { role: finalRole, parts: finalParts }],
        clientFunctions: combinedClientFunctions,
        abortSignal: newAbortController.signal,
        runTurn: (contents) =>
          generateContentTurnApi(keyToUse, apiModelId, contents, requestConfig, newAbortController.signal),
      });

      if (toolLoopResult.toolMessages.length > 0) {
        const internalMessages = toolLoopResult.toolMessages.flatMap(({ modelContent, functionResponseParts }) => [
          createMessage('model', '', {
            apiParts: modelContent.parts,
            isInternalToolMessage: true,
            toolParentMessageId: generationId,
          }),
          createMessage('user', '', {
            apiParts: functionResponseParts,
            isInternalToolMessage: true,
            toolParentMessageId: generationId,
          }),
        ]);

        updateAndPersistSessions(
          (prev) =>
            updateSessionById(prev, finalSessionId, (session) => ({
              ...session,
              messages: session.messages.flatMap((message) => {
                if (message.id !== generationId) {
                  return [message];
                }

                return [
                  ...internalMessages,
                  {
                    ...message,
                  },
                ];
              }),
            })),
          { persist: false },
        );
      }

      for (const part of toolLoopResult.finalTurn.parts) {
        streamOnPart(part, { recordFirstToken: false });
      }
      if (toolLoopResult.finalTurn.thoughts) {
        onThoughtChunk(toolLoopResult.finalTurn.thoughts, { recordFirstToken: false });
      }
      streamOnComplete(
        toolLoopResult.finalTurn.usage,
        toolLoopResult.finalTurn.grounding,
        toolLoopResult.finalTurn.urlContext,
        toolLoopResult.generatedFiles,
      );
    } catch (error) {
      streamOnError(toError(error));
    }
    return;
  }

  if (appSettings.isStreamingEnabled) {
    // Stream journal: only the Docker default (relative /api/gemini) routes
    // through our api container where the job buffer lives. Absolute proxy
    // URLs bypass the container, so journaling is skipped there. Also only
    // meaningful for a fresh user-driven turn (the common resume case); tool
    // loops and other internal turns don't carry a stable generation id.
    const canJournalStream =
      !activeProvider && isGeminiProxyRelativePath(appSettings) && finalRole === 'user' && !isContinueMode;
    const streamResume = canJournalStream
      ? {
          jobId: generationId,
          lastSeq: 0,
          onSeq: (seq: number) => advancePendingStreamJobSeq(finalSessionId, seq),
        }
      : undefined;

    if (canJournalStream) {
      recordPendingStreamJob({
        sessionId: finalSessionId,
        generationId,
        jobId: generationId,
        startedAt: generationStartTime.getTime(),
      });
    }

    await routeThrownStreamError(
      () =>
        sendStatelessMessageStreamApi(
          keyToUse,
          apiModelId,
          historyForChat,
          finalParts,
          requestConfig,
          newAbortController.signal,
          streamOnPart,
          onThoughtChunk,
          streamOnError,
          wrappedStreamOnComplete,
          finalRole,
          undefined,
          streamResume,
        ),
      streamOnError,
    );
    return;
  }

  await routeThrownStreamError(
    () =>
      sendStatelessMessageNonStreamApi(
        keyToUse,
        apiModelId,
        historyForChat,
        finalParts,
        requestConfig,
        newAbortController.signal,
        streamOnError,
        nonStreamOnComplete,
        finalRole,
      ),
    streamOnError,
  );
};
