import type { GenerateContentResponse, UsageMetadata } from '@google/genai';
import { type ChatHistoryItem, type StreamMessageSender, type NonStreamMessageSender } from '@/types';
import { logService } from '@/services/logService';
import { executeConfiguredApiRequest } from './apiExecutor';
import { adaptGenAiResponse, mergeGroundingMetadata, type MetadataWithCitations } from './chatResponseAdapter';
import { getHttpOptionsForContents, withHttpOptionHeaders } from './geminiApiVersion';

const withAbortSignal = <T extends object>(
  config: T | undefined,
  abortSignal: AbortSignal,
): T & { abortSignal: AbortSignal } => ({
  ...(config || ({} as T)),
  abortSignal,
});

export const generateContentTurnApi = async (
  apiKey: string,
  modelId: string,
  contents: ChatHistoryItem[],
  config: unknown,
  abortSignal: AbortSignal,
) => {
  const abortError = new Error('aborted');
  abortError.name = 'AbortError';

  if (abortSignal.aborted) {
    throw abortError;
  }

  const response = await executeConfiguredApiRequest({
    apiKey,
    label: `Generating content turn for ${modelId}`,
    errorLabel: `Error generating content turn for ${modelId}:`,
    abortSignal,
    httpOptions: getHttpOptionsForContents(contents),
    run: async ({ client: ai }) =>
      ai.models.generateContent({
        model: modelId,
        contents,
        config: withAbortSignal(config as Parameters<typeof ai.models.generateContent>[0]['config'], abortSignal),
      }),
  });

  if (abortSignal.aborted) {
    throw abortError;
  }

  const { parts, thoughts, usage, grounding, urlContext } = adaptGenAiResponse(response);
  const candidateContent = response.candidates?.[0]?.content;

  return {
    modelContent: {
      role: 'model' as const,
      parts: candidateContent?.parts ?? parts,
    },
    parts,
    thoughts,
    usage,
    grounding,
    urlContext,
    functionCalls: response.functionCalls ?? [],
  };
};

export const sendStatelessMessageStreamApi: StreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onPart,
  onThoughtChunk,
  onError,
  onComplete,
  role = 'user',
  // Gemini-native calls ignore providerId; the param exists only so the shared
  // StreamMessageSender signature matches the OpenAI/Anthropic senders.
  _providerId,
  streamResume,
) => {
  logService.info(`Sending message via stateless generateContentStream for ${modelId} (Role: ${role})`);
  let finalUsageMetadata: UsageMetadata | undefined = undefined;
  let finalGroundingMetadata: MetadataWithCitations | null = null;
  let finalUrlContextMetadata: unknown = null;
  const contents = [...history, { role, parts }];

  // Stream-journal resume: stamp x-amc-job-id / x-amc-last-seq on the request
  // so the api container replays the buffered upstream from this cursor.
  const resumeHeaders = streamResume
    ? {
        'x-amc-job-id': streamResume.jobId,
        'x-amc-last-seq': String(streamResume.lastSeq),
      }
    : undefined;

  try {
    await executeConfiguredApiRequest({
      apiKey,
      label: `Sending message via stateless generateContentStream for ${modelId} (Role: ${role})`,
      errorLabel: 'Error sending message (stream):',
      httpOptions: withHttpOptionHeaders(getHttpOptionsForContents(contents), resumeHeaders),
      run: async ({ client: ai }) => {
        if (abortSignal.aborted) {
          logService.warn('Streaming aborted by signal before start.');
          return;
        }

        const result = await ai.models.generateContentStream({
          model: modelId,
          contents,
          config: withAbortSignal(
            config as Parameters<typeof ai.models.generateContentStream>[0]['config'],
            abortSignal,
          ),
        });

        let resumeSeq = streamResume?.lastSeq ?? 0;
        for await (const chunkResponse of result) {
          if (abortSignal.aborted) {
            logService.warn('Streaming aborted by signal.');
            break;
          }
          const adaptedChunk = adaptGenAiResponse(chunkResponse as GenerateContentResponse);

          if (adaptedChunk.usage) {
            finalUsageMetadata = adaptedChunk.usage;
          }
          finalGroundingMetadata = mergeGroundingMetadata(finalGroundingMetadata, adaptedChunk.grounding);
          if (adaptedChunk.urlContext) {
            finalUrlContextMetadata = adaptedChunk.urlContext;
          }
          if (adaptedChunk.thoughts) {
            onThoughtChunk(adaptedChunk.thoughts);
          }
          for (const part of adaptedChunk.parts) {
            onPart(part);
          }
          // Each streamed chunk from the SDK maps to one journal event on the
          // wire (the proxy splits on \n\n). Advance the cursor so a future
          // resume picks up at the next boundary.
          if (streamResume?.onSeq) {
            resumeSeq += 1;
            streamResume.onSeq(resumeSeq);
          }
        }
      },
    });
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error) || 'Unknown error during streaming.'));
    return;
  } finally {
    logService.info('Streaming complete.', { usage: finalUsageMetadata, hasGrounding: !!finalGroundingMetadata });
  }

  onComplete(finalUsageMetadata, finalGroundingMetadata, finalUrlContextMetadata);
};

export const sendStatelessMessageNonStreamApi: NonStreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onError,
  onComplete,
  role = 'user',
  _providerId,
) => {
  logService.info(`Sending message via stateless generateContent (non-stream) for model ${modelId}`);
  const contents = [...history, { role, parts }];

  try {
    await executeConfiguredApiRequest({
      apiKey,
      label: `Sending message via stateless generateContent (non-stream) for model ${modelId}`,
      errorLabel: `Error in stateless non-stream for ${modelId}:`,
      httpOptions: getHttpOptionsForContents(contents),
      run: async ({ client: ai }) => {
        if (abortSignal.aborted) {
          onComplete([], '', undefined, undefined, undefined);
          return;
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config: withAbortSignal(config as Parameters<typeof ai.models.generateContent>[0]['config'], abortSignal),
        });

        if (abortSignal.aborted) {
          onComplete([], '', undefined, undefined, undefined);
          return;
        }

        const { parts: responseParts, thoughts, usage, grounding, urlContext } = adaptGenAiResponse(response);

        logService.info(`Stateless non-stream complete for ${modelId}.`, {
          usage,
          hasGrounding: !!grounding,
          hasUrlContext: !!urlContext,
        });
        onComplete(responseParts, thoughts, usage, grounding, urlContext);
      },
    });
  } catch (error) {
    onError(
      error instanceof Error ? error : new Error(String(error) || 'Unknown error during stateless non-streaming call.'),
    );
  }
};
