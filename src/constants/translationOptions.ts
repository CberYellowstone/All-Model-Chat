import type { TranslationTargetLanguage } from '@/types';

export const DEFAULT_TRANSLATION_TARGET_LANGUAGE: TranslationTargetLanguage = 'English';
export const DEFAULT_THOUGHT_TRANSLATION_TARGET_LANGUAGE: TranslationTargetLanguage = 'Simplified Chinese';

export const TRANSLATION_TARGET_LANGUAGE_OPTIONS: Array<{
  value: TranslationTargetLanguage;
  labelKey: string;
}> = [
  { value: 'English', labelKey: 'translationTargetLanguageEnglish' },
  { value: 'Simplified Chinese', labelKey: 'translationTargetLanguageSimplifiedChinese' },
  { value: 'Traditional Chinese', labelKey: 'translationTargetLanguageTraditionalChinese' },
  { value: 'Japanese', labelKey: 'translationTargetLanguageJapanese' },
  { value: 'Korean', labelKey: 'translationTargetLanguageKorean' },
  { value: 'Spanish', labelKey: 'translationTargetLanguageSpanish' },
  { value: 'French', labelKey: 'translationTargetLanguageFrench' },
  { value: 'German', labelKey: 'translationTargetLanguageGerman' },
];

/**
 * Live Translate 源语言选项。包含 'auto'（自动检测）。
 * value 为语言名（与 systemInstruction 一致），labelKey 为 i18n key。
 */
export const LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS: Array<{
  value: string;
  labelKey: string;
}> = [
  { value: 'auto', labelKey: 'liveTranslateSourceLanguageAuto' },
  ...TRANSLATION_TARGET_LANGUAGE_OPTIONS,
];

/**
 * Live Translate 目标语言选项。复用现有目标语言列表（不含 auto）。
 */
export const LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS = TRANSLATION_TARGET_LANGUAGE_OPTIONS;
