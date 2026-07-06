import type { OpenAIResponsePayload } from './openaiCompatibleTypes';

export const extractOpenAICompatibleMessageText = (payload: OpenAIResponsePayload): string => {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text)
      .filter((text): text is string => typeof text === 'string')
      .join('');
  }

  return '';
};

export const extractOpenAICompatibleReasoningText = (payload: OpenAIResponsePayload): string | undefined => {
  const reasoningContent = payload.choices?.[0]?.message?.reasoning_content;
  return typeof reasoningContent === 'string' && reasoningContent ? reasoningContent : undefined;
};
