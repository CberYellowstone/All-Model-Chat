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
 * Live Translate 目标语言选项。
 *
 * value 为 BCP-47 语言代码（官方 translationConfig.targetLanguageCode 要求的格式）。
 * 源语言由模型自动检测，故此处不提供源语言列表。
 */
export const LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS: Array<{
  value: string;
  labelKey: string;
}> = [
  { value: 'en', labelKey: 'liveTranslateLanguageEnglish' },
  { value: 'zh-Hans', labelKey: 'liveTranslateLanguageSimplifiedChinese' },
  { value: 'zh-Hant', labelKey: 'liveTranslateLanguageTraditionalChinese' },
  { value: 'ja', labelKey: 'liveTranslateLanguageJapanese' },
  { value: 'ko', labelKey: 'liveTranslateLanguageKorean' },
  { value: 'es', labelKey: 'liveTranslateLanguageSpanish' },
  { value: 'fr', labelKey: 'liveTranslateLanguageFrench' },
  { value: 'de', labelKey: 'liveTranslateLanguageGerman' },
  { value: 'it', labelKey: 'liveTranslateLanguageItalian' },
  { value: 'pt-BR', labelKey: 'liveTranslateLanguagePortugueseBrazil' },
  { value: 'ru', labelKey: 'liveTranslateLanguageRussian' },
  { value: 'ar', labelKey: 'liveTranslateLanguageArabic' },
  { value: 'hi', labelKey: 'liveTranslateLanguageHindi' },
  { value: 'pl', labelKey: 'liveTranslateLanguagePolish' },
  { value: 'vi', labelKey: 'liveTranslateLanguageVietnamese' },
  { value: 'th', labelKey: 'liveTranslateLanguageThai' },
  { value: 'id', labelKey: 'liveTranslateLanguageIndonesian' },
];

export const DEFAULT_LIVE_TRANSLATE_TARGET_LANGUAGE_CODE = 'en';
