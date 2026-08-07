import type { McpServerAuthType, McpServerConfig, McpServerTransport } from '../../shared/mcpServerConfig';

export interface ModelOption {
  id: string;
  name: string;
  isPinned?: boolean;
  apiMode?: ApiMode;
  providerId?: ThirdPartyProviderId;
}

export enum HarmCategory {
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
  HARM_CATEGORY_CIVIC_INTEGRITY = 'HARM_CATEGORY_CIVIC_INTEGRITY',
}

export enum HarmBlockThreshold {
  OFF = 'OFF',
  BLOCK_NONE = 'BLOCK_NONE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
}

export enum MediaResolution {
  MEDIA_RESOLUTION_UNSPECIFIED = 'MEDIA_RESOLUTION_UNSPECIFIED',
  MEDIA_RESOLUTION_LOW = 'MEDIA_RESOLUTION_LOW',
  MEDIA_RESOLUTION_MEDIUM = 'MEDIA_RESOLUTION_MEDIUM',
  MEDIA_RESOLUTION_HIGH = 'MEDIA_RESOLUTION_HIGH',
  MEDIA_RESOLUTION_ULTRA_HIGH = 'MEDIA_RESOLUTION_ULTRA_HIGH',
}

export type ImageOutputMode = 'IMAGE_TEXT' | 'IMAGE_ONLY';
export type ImagePersonGeneration = 'ALLOW_ADULT' | 'ALLOW_ALL' | 'DONT_ALLOW';
/** All valid API modes — used for both type checking and runtime validation. */
export const API_MODES = ['gemini-native', 'third-party'] as const;
export type ApiMode = (typeof API_MODES)[number];

/** The built-in Gemini provider id used in session routing. */
export const GEMINI_PROVIDER_ID = 'gemini-native';

/**
 * Normalize the apiMode tag on a persisted ModelOption (the "provider family"
 * label set by the model list editor). The legacy 'openai-compatible' tag is
 * folded into 'third-party' so old custom third-party models keep grouping
 * under the Third-Party section instead of disappearing or dropping to the
 * OpenAI Compatible segment.
 */
export const normalizeModelApiModeTag = (value: unknown): ApiMode | undefined => {
  if (value === 'gemini-native' || value === 'third-party') {
    return value;
  }
  if (value === 'openai-compatible') {
    return 'third-party';
  }
  return undefined;
};
export type { McpServerAuthType, McpServerConfig, McpServerTransport };

/** Wire protocol supported by a third-party API provider. */
export type ThirdPartyApiProtocol = 'openai-compatible' | 'anthropic';

/** Identifiers for built-in third-party API providers. */
export const THIRD_PARTY_PROVIDER_IDS = [
  'openai',
  'deepseek',
  'anthropic',
  'openrouter',
  'qwen',
  'kimi',
  'glm',
  'custom',
] as const;
export type ThirdPartyProviderId = (typeof THIRD_PARTY_PROVIDER_IDS)[number];

/** Every provider a session can route to: the built-in Gemini API or one of the
 * third-party providers. Absent = derive from the modelId (gemini by default). */
export const CHAT_PROVIDER_IDS = [GEMINI_PROVIDER_ID, ...THIRD_PARTY_PROVIDER_IDS] as const;
export type ChatProviderId = (typeof CHAT_PROVIDER_IDS)[number];

/** Connection + model configuration for a single third-party provider. */
export interface ThirdPartyProviderConfig {
  apiKey: string | null;
  baseUrl: string | null;
  modelId: string;
  models: ModelOption[];
  protocol: ThirdPartyApiProtocol;
  enabled?: boolean;
}

/** Top-level container for all third-party provider configurations. */
export interface ThirdPartyApiSettings {
  activeProvider: ThirdPartyProviderId;
  providers: Record<ThirdPartyProviderId, ThirdPartyProviderConfig>;
}

/** All valid thinking levels — used for both type checking and runtime validation. */
export const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
/** All valid live artifacts prompt modes — used for both type checking and runtime validation. */
export const LIVE_ARTIFACTS_PROMPT_MODES = ['inline'] as const;
export type LiveArtifactsPromptMode = (typeof LIVE_ARTIFACTS_PROMPT_MODES)[number];
export type LiveArtifactsSystemPrompts = Record<LiveArtifactsPromptMode, string>;
/** All valid translation target languages — used for both type checking and runtime validation. */
export const TRANSLATION_TARGET_LANGUAGES = [
  'English',
  'Simplified Chinese',
  'Traditional Chinese',
  'Japanese',
  'Korean',
  'Spanish',
  'French',
  'German',
] as const;
export type TranslationTargetLanguage = (typeof TRANSLATION_TARGET_LANGUAGES)[number];

/** All valid app language identifiers — used for both type checking and runtime validation. */
export const APP_LANGUAGE_IDS = ['en', 'zh', 'system'] as const;
export type AppLanguage = (typeof APP_LANGUAGE_IDS)[number];

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export interface FilesApiConfig {
  images: boolean;
  pdfs: boolean;
  audio: boolean;
  video: boolean;
  text: boolean;
}

export interface ChatSettings {
  modelId: string;
  /** Which provider this session's modelId belongs to. Absent = gemini-native. */
  providerId?: ChatProviderId;
  temperature: number;
  topP: number;
  topK: number;
  showThoughts: boolean;
  systemInstruction: string;
  ttsVoice: string;
  thinkingBudget: number;
  thinkingLevel?: ThinkingLevel;
  lockedApiKey?: string | null;
  isGoogleSearchEnabled?: boolean;
  isGoogleMapsEnabled?: boolean;
  isCodeExecutionEnabled?: boolean;
  isLocalPythonEnabled?: boolean;
  isUrlContextEnabled?: boolean;
  isDeepSearchEnabled?: boolean;
  isRawModeEnabled?: boolean;
  hideThinkingInContext?: boolean;
  alwaysKeepThinkingInContext?: boolean;
  safetySettings?: SafetySetting[];
  mediaResolution?: MediaResolution;
}

export type ChatSettingsUpdater = (updater: (prevSettings: ChatSettings) => ChatSettings) => void;

/**
 * Normalize a persisted session providerId read from storage/imports.
 * Only known provider ids survive; legacy 'openai-compatible' folds to
 * gemini-native (the routing decision only recognizes real provider ids).
 */
export const normalizeProviderId = (value: unknown): ChatProviderId | undefined =>
  typeof value === 'string' && (CHAT_PROVIDER_IDS as readonly string[]).includes(value)
    ? (value as ChatProviderId)
    : undefined;

export interface AppSettings extends ChatSettings {
  themeId: 'system' | 'onyx' | 'graphite' | 'pearl';
  baseFontSize: number;
  useCustomApiConfig: boolean;
  serverManagedApi?: boolean;
  apiKey: string | null;
  apiProxyUrl: string | null;
  useApiProxy?: boolean;
  language: AppLanguage;
  translationTargetLanguage: TranslationTargetLanguage;
  inputTranslationModelId?: string;
  thoughtTranslationTargetLanguage?: TranslationTargetLanguage;
  thoughtTranslationModelId?: string;
  showInputTranslationButton?: boolean;
  isStreamingEnabled: boolean;
  transcriptionModelId: string;
  filesApiConfig: FilesApiConfig;
  expandCodeBlocksByDefault: boolean;
  isAutoTitleEnabled: boolean;
  isMermaidRenderingEnabled: boolean;
  isGraphvizRenderingEnabled?: boolean;
  isCompletionNotificationEnabled: boolean;
  isCompletionSoundEnabled?: boolean;
  isSuggestionsEnabled: boolean;
  isAutoScrollOnSendEnabled?: boolean;
  isAutoSendOnSuggestionClick?: boolean;
  generateQuadImages?: boolean;
  autoFullscreenHtml?: boolean;
  /** 将语言误标为 css/text/txt/markdown/md、内容却像完整 HTML 文档或含 LA
   *  标记的代码块自动解包为实时预览。关闭后此类代码块一律按源码显示。 */
  unwrapMislabeledHtmlBlocks?: boolean;
  showWelcomeSuggestions?: boolean;
  isAudioCompressionEnabled: boolean;
  liveArtifactsPromptMode?: LiveArtifactsPromptMode;
  liveArtifactsSystemPrompt?: string;
  liveArtifactsSystemPrompts?: LiveArtifactsSystemPrompts;
  liveArtifactsCustomFontSize?: number;
  isPasteRichTextAsMarkdownEnabled?: boolean;
  isPasteAsTextFileEnabled?: boolean;
  showInputPasteButton?: boolean;
  showInputClearButton?: boolean;
  isCopySelectionFormattingEnabled?: boolean;
  isSystemAudioRecordingEnabled?: boolean;
  mcpServers: McpServerConfig[];
  customShortcuts: Record<string, string>; // ID -> Key Combination String
  tabModelCycleIds?: string[];
  liveTranslateTargetLanguageCode: string; // 目标语言 BCP-47 代码（源语言由模型自动检测）
  liveTranslateEchoTargetLanguage: boolean; // 输入已是目标语言时是否回放原声
  thirdPartyApi: ThirdPartyApiSettings;
}
