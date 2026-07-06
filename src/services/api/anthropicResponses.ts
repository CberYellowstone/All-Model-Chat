import type { AnthropicResponsePayload } from './anthropicTypes';

export const extractAnthropicMessageText = (payload: AnthropicResponsePayload): string => {
  if (!Array.isArray(payload.content)) {
    return '';
  }
  return payload.content
    .map((block) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('');
};
