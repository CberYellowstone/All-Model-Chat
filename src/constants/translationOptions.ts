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
