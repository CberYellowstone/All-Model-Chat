import type { Part } from '@google/genai';
import type { ChatHistoryItem, ThinkingLevel } from '@/types';
import { isImageMimeType } from '@/utils/file/fileTypeClassification';
import type { AnthropicChatConfig, AnthropicContentBlock, AnthropicMessage } from './anthropicTypes';

const ANTHROPIC_FILE_DATA_ERROR = 'Anthropic mode cannot send Gemini Files API file references.';

const partToAnthropicContentItems = (part: Part): AnthropicContentBlock[] => {
  const partWithMedia = part as Part & {
    inlineData?: { mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
  };

  if (typeof part.text === 'string') {
    return part.text ? [{ type: 'text', text: part.text }] : [];
  }

  if (partWithMedia.fileData) {
    throw new Error(ANTHROPIC_FILE_DATA_ERROR);
  }

  const inlineData = partWithMedia.inlineData;
  const mimeType = inlineData?.mimeType;
  if (inlineData?.data && mimeType && isImageMimeType(mimeType)) {
    return [
      {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: inlineData.data },
      },
    ];
  }

  if (inlineData?.data) {
    throw new Error(`Anthropic mode cannot send inline ${mimeType || 'media'} attachments.`);
  }

  return [];
};

const partsToAnthropicContent = (parts: Part[]): string | AnthropicContentBlock[] => {
  const items = parts.flatMap(partToAnthropicContentItems);
  const hasOnlyText = items.every((item) => item.type === 'text');
  if (hasOnlyText) {
    return items
      .map((item) => (item.type === 'text' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return items;
};

const hasAnthropicContent = (content: string | AnthropicContentBlock[]) =>
  typeof content === 'string' ? content.trim().length > 0 : content.length > 0;

const buildAnthropicMessages = (
  history: ChatHistoryItem[],
  parts: Part[],
  role: 'user' | 'model',
): AnthropicMessage[] => {
  const messages: AnthropicMessage[] = [];
  for (const item of history) {
    const content = partsToAnthropicContent(item.parts);
    if (!hasAnthropicContent(content)) continue;
    messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content });
  }
  const currentContent = partsToAnthropicContent(parts);
  if (hasAnthropicContent(currentContent)) {
    messages.push({ role: role === 'model' ? 'assistant' : 'user', content: currentContent });
  }
  return messages;
};

const ANTHROPIC_OUTPUT_TOKENS = 8192;
const ANTHROPIC_MIN_THINKING_BUDGET = 1024;

/**
 * Models that use adaptive thinking + output_config.effort.
 * Manual extended thinking (`thinking: { type: "enabled", budget_tokens }`) is rejected
 * on Claude Sonnet 5 / Opus 5 / Opus 4.8 / Fable 5 — use effort instead.
 */
const isAnthropicEffortModel = (modelId: string): boolean => {
  const id = modelId.toLowerCase();
  if (/fable|mythos/.test(id)) {
    return true;
  }
  // Claude 5 family and recent 4.6–4.8 Opus/Sonnet effort models.
  if (
    /claude-opus-5|claude-sonnet-5|claude-opus-4-[678]|claude-sonnet-4-6/.test(id) ||
    /opus-5|sonnet-5|opus-4\.[678]|sonnet-4\.6/.test(id)
  ) {
    return true;
  }
  return false;
};

const mapThinkingLevelToAnthropicEffort = (level: ThinkingLevel | undefined): 'low' | 'medium' | 'high' => {
  switch (level) {
    case 'MINIMAL':
    case 'LOW':
      return 'low';
    case 'MEDIUM':
      return 'medium';
    case 'HIGH':
    default:
      return 'high';
  }
};

export const buildAnthropicRequestBody = (
  modelId: string,
  history: ChatHistoryItem[],
  parts: Part[],
  config: AnthropicChatConfig,
  role: 'user' | 'model',
  stream: boolean,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: buildAnthropicMessages(history, parts, role),
    stream,
    max_tokens: ANTHROPIC_OUTPUT_TOKENS,
  };

  const systemInstruction = config.systemInstruction?.trim();
  if (systemInstruction) {
    body.system = systemInstruction;
  }
  if (typeof config.temperature === 'number') {
    body.temperature = config.temperature;
  }
  if (typeof config.topP === 'number') {
    body['top_p'] = config.topP;
  }

  if (isAnthropicEffortModel(modelId)) {
    // Adaptive models: control thoroughness via output_config.effort; never send budget_tokens.
    body.output_config = { effort: mapThinkingLevelToAnthropicEffort(config.thinkingLevel) };
  } else if (typeof config.thinkingBudget === 'number' && config.thinkingBudget > 0) {
    // Legacy extended thinking for models that still accept budget_tokens (e.g. Haiku).
    const budgetTokens = Math.max(ANTHROPIC_MIN_THINKING_BUDGET, config.thinkingBudget);
    body.thinking = { type: 'enabled', budget_tokens: budgetTokens };
    body.max_tokens = budgetTokens + ANTHROPIC_OUTPUT_TOKENS;
  }

  return body;
};
