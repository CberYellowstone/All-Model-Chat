import type { UsageMetadata } from '@google/genai';
import { readResponseErrorMessage, toError } from '@/utils/errorMessage';
import { deduplicateModelsById } from '@/utils/model/modelSorting';
import type { ModelOption, NonStreamMessageSender, StreamMessageSender } from '@/types';
import { logService } from '@/services/logService';
import { buildOpenAICompatibleRequestBody } from './openaiCompatibleMessages';
import { extractOpenAICompatibleMessageText, extractOpenAICompatibleReasoningText } from './openaiCompatibleResponses';
import { readOpenAICompatibleStreamEvents } from './openaiCompatibleStream';
import {
  asOpenAICompatibleConfig,
  mapOpenAICompatibleUsage,
  type OpenAIModelsResponsePayload,
  type OpenAIResponsePayload,
} from './openaiCompatibleTypes';
import { buildOpenAICompatibleChatCompletionsUrl, buildOpenAICompatibleModelsUrl } from './openaiCompatibleUrls';

const createRequestInit = (apiKey: string, body: Record<string, unknown>, abortSignal: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: abortSignal,
});

const createGetRequestInit = (apiKey: string, abortSignal: AbortSignal): RequestInit => ({
  method: 'GET',
  headers: {
    authorization: `Bearer ${apiKey}`,
  },
  signal: abortSignal,
});

export const fetchOpenAICompatibleModels = async (
  apiKey: string,
  baseUrl: string | null | undefined,
  abortSignal: AbortSignal,
): Promise<ModelOption[]> => {
  const response = await fetch(buildOpenAICompatibleModelsUrl(baseUrl), createGetRequestInit(apiKey, abortSignal));

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, 'OpenAI-compatible'));
  }

  const payload = (await response.json()) as OpenAIModelsResponsePayload;
  const rawModels = (payload.data ?? [])
    .map((item) => (typeof item.id === 'string' ? item.id.trim() : ''))
    .filter((id) => id.length > 0)
    .map((id) => ({ id, name: id }));
  return deduplicateModelsById(rawModels);
};

export const sendOpenAICompatibleMessageNonStream: NonStreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onError,
  onComplete,
  role = 'user',
) => {
  const compatibleConfig = asOpenAICompatibleConfig(config);

  try {
    if (abortSignal.aborted) {
      onComplete([], undefined, undefined, undefined, undefined);
      return;
    }

    const response = await fetch(
      buildOpenAICompatibleChatCompletionsUrl(compatibleConfig.baseUrl),
      createRequestInit(
        apiKey,
        buildOpenAICompatibleRequestBody(modelId, history, parts, compatibleConfig, role, false),
        abortSignal,
      ),
    );

    if (!response.ok) {
      throw new Error(await readResponseErrorMessage(response, 'OpenAI-compatible'));
    }

    const payload = (await response.json()) as OpenAIResponsePayload;
    if (abortSignal.aborted) {
      onComplete([], undefined, undefined, undefined, undefined);
      return;
    }

    const text = extractOpenAICompatibleMessageText(payload);
    onComplete(
      text ? [{ text }] : [],
      extractOpenAICompatibleReasoningText(payload),
      mapOpenAICompatibleUsage(payload.usage),
      undefined,
      undefined,
    );
  } catch (error) {
    logService.error('OpenAI-compatible non-stream request failed:', error);
    onError(toError(error));
  }
};

export const sendOpenAICompatibleMessageStream: StreamMessageSender = async (
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
) => {
  const compatibleConfig = asOpenAICompatibleConfig(config);
  let finalUsage: UsageMetadata | undefined;

  try {
    if (abortSignal.aborted) {
      onComplete(undefined, undefined, undefined);
      return;
    }

    const response = await fetch(
      buildOpenAICompatibleChatCompletionsUrl(compatibleConfig.baseUrl),
      createRequestInit(
        apiKey,
        buildOpenAICompatibleRequestBody(modelId, history, parts, compatibleConfig, role, true),
        abortSignal,
      ),
    );

    if (!response.ok) {
      throw new Error(await readResponseErrorMessage(response, 'OpenAI-compatible'));
    }

    await readOpenAICompatibleStreamEvents(response, abortSignal, (payload) => {
      const reasoningContent = payload.choices?.[0]?.delta?.reasoning_content;
      if (reasoningContent) {
        onThoughtChunk(reasoningContent);
      }

      const content = payload.choices?.[0]?.delta?.content;
      if (content) {
        onPart({ text: content });
      }

      const usage = mapOpenAICompatibleUsage(payload.usage);
      if (usage) {
        finalUsage = usage;
      }
    });

    onComplete(finalUsage, undefined, undefined);
  } catch (error) {
    logService.error('OpenAI-compatible stream request failed:', error);
    onError(toError(error));
  }
};
