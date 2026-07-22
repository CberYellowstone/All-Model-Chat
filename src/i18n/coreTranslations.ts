import { appTranslations } from './translations/app';
import { headerTranslations } from './translations/header';
import { chatInputTranslations } from './translations/chatInput';
import { messagesTranslations } from './translations/messages';
import { historyTranslations } from './translations/history';
import { commonTranslations } from './translations/common';
import { ttsStyleTranslations } from './voiceStyleTranslations';

export type SupportedLanguage = 'en' | 'zh';
export type TranslationEntry = Partial<Record<SupportedLanguage, string>>;
export type TranslationMap = Record<string, TranslationEntry>;

/**
 * Shell / always-mounted chrome strings that must work before lazy feature
 * packs (settings, etc.) are registered via `ensureFeatureTranslations`.
 *
 * Keep this list minimal and only for UI that renders on the main shell path
 * (sidebar, chat toolbar, PWA banner). Full settings copy lives under
 * `src/i18n/translations/settings/*` and is loaded on demand.
 *
 * Keys that also appear in lazy packs (e.g. settingsTitle) are intentional:
 * core owns the bootstrap value; the lazy pack may re-register the same
 * strings when the settings modal loads. Prefer editing both places if wording
 * changes, or move the key solely into core if only shell needs it early.
 */
const shellFeatureTranslations: TranslationMap = {
  // Sidebar + settings modal chrome (modal also loads the full settings pack).
  settingsTitle: { en: 'Settings', zh: '设置' },
  // Chat toolbar selectors (mounted before settings pack).
  settingsTtsVoice: { en: 'Speech Voice', zh: '语音音色' },
  settingsMediaResolution: { en: 'Input Detail Level', zh: '输入细节等级' },
  // CamelCase labels used by MediaResolutionSelector on the chat chrome.
  mediaResolutionUnspecified: { en: 'Auto (Default)', zh: '自动（默认）' },
  mediaResolutionLow: { en: 'Low (Faster)', zh: '低（较快）' },
  mediaResolutionMedium: { en: 'Medium (Balanced)', zh: '中（平衡）' },
  mediaResolutionHigh: { en: 'High (Detail)', zh: '高（细节）' },
  mediaResolutionUltraHigh: { en: 'Ultra High (Images only)', zh: '超高（仅限图片）' },
  // PWA update banner (always available).
  aboutUpdateReady: { en: 'Update ready to refresh', zh: '发现可用更新' },
  pwaUpdateRefreshPrompt: {
    en: 'Refresh to update the installed shell and latest assets.',
    zh: '刷新以更新已安装的应用外壳和最新资源。',
  },
  pwaUpdateLater: { en: 'Later', zh: '稍后' },
  ...ttsStyleTranslations,
};

export const translations: TranslationMap = {
  ...appTranslations,
  ...headerTranslations,
  ...chatInputTranslations,
  ...messagesTranslations,
  ...historyTranslations,
  ...commonTranslations,
  ...shellFeatureTranslations,
};

export const registerTranslations = (translationMap: TranslationMap) => {
  Object.assign(translations, translationMap);
};

export const getTranslator =
  (lang: SupportedLanguage) =>
  (key: keyof typeof translations | string, fallback?: string): string => {
    const translationSet = translations as TranslationMap;
    return translationSet[key]?.[lang] ?? fallback ?? translationSet[key]?.en ?? key;
  };
