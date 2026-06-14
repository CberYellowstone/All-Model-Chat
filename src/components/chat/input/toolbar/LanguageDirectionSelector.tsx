import React from 'react';
import { Languages } from 'lucide-react';
import { Select } from '@/components/shared/Select';
import { useI18n } from '@/contexts/I18nContext';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS,
  LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS,
} from '@/constants/translationOptions';

/**
 * Live Translate 模式的语言方向选择器（源语言 + 目标语言）。
 * 替代普通 Live 模式的 voice 选择器。读写 appSettings 顶层字段。
 */
export const LanguageDirectionSelector: React.FC = () => {
  const { t } = useI18n();
  const sourceLanguage = useSettingsStore((state) => state.appSettings.liveTranslateSourceLanguage);
  const targetLanguage = useSettingsStore((state) => state.appSettings.liveTranslateTargetLanguage);
  const setAppSettings = useSettingsStore((state) => state.setAppSettings);

  return (
    <div className="flex items-center gap-2">
      <Languages size={14} className="text-purple-500 flex-shrink-0" />
      <Select
        id="live-translate-source-language"
        label={t('liveTranslateSourceLanguageLabel')}
        hideLabel
        value={sourceLanguage}
        onChange={(e) => setAppSettings((prev) => ({ ...prev, liveTranslateSourceLanguage: e.target.value }))}
        className="mb-0"
        wrapperClassName="relative min-w-[120px] w-auto"
        direction="up"
        dropdownClassName="!w-auto !min-w-full max-h-[300px]"
      >
        {LIVE_TRANSLATE_SOURCE_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </Select>
      <span className="text-[var(--theme-text-secondary)] text-sm">→</span>
      <Select
        id="live-translate-target-language"
        label={t('liveTranslateTargetLanguageLabel')}
        hideLabel
        value={targetLanguage}
        onChange={(e) => setAppSettings((prev) => ({ ...prev, liveTranslateTargetLanguage: e.target.value }))}
        className="mb-0"
        wrapperClassName="relative min-w-[120px] w-auto"
        direction="up"
        dropdownClassName="!w-auto !min-w-full max-h-[300px]"
      >
        {LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </Select>
    </div>
  );
};
