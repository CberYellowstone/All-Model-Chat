import type { AnthropicResponsePayload } from './anthropicTypes';

export const extractAnthropicMessageText = (payload: AnthropicResponsePayload): string => {
  if (!Array.isArray(payload.content)) {
    return '';
  }
  return payload.content
    .filter((block) => block.type !== 'thinking')
    .map((block) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('');
};

export const extractAnthropicMessageThoughts = (payload: AnthropicResponsePayload): string | undefined => {
  if (!Array.isArray(payload.content)) {
    return undefined;
  }
  const thoughts = payload.content
    .filter((block) => block.type === 'thinking')
    .map((block) => block.thinking)
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
    .join('\n\n');
  return thoughts.length > 0 ? thoughts : undefined;
};
