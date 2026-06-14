import React from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { Select } from '@/components/shared/Select';
import { useI18n } from '@/contexts/I18nContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { LIVE_TRANSLATE_TARGET_LANGUAGE_OPTIONS } from '@/constants/translationOptions';

/**
 * Live Translate 模式的目标语言选择器（替代普通 Live 模式的 voice 选择器）。
 *
 * 官方 API 中源语言由模型自动检测，故只暴露目标语言（BCP-47 代码）。
 * 附带 echo 开关：输入已是目标语言时是否原声回放。读写 appSettings 顶层字段。
 */
export const LanguageDirectionSelector: React.FC = () => {
  const { t } = useI18n();
  const targetLanguageCode = useSettingsStore((state) => state.appSettings.liveTranslateTargetLanguageCode);
  const echoTargetLanguage = useSettingsStore((state) => state.appSettings.liveTranslateEchoTargetLanguage);
  const setAppSettings = useSettingsStore((state) => state.setAppSettings);

  return (
    <div className="flex items-center gap-2">
      <Languages size={14} className="text-purple-500 flex-shrink-0" />
      <Select
        id="live-translate-target-language"
        label={t('liveTranslateTargetLanguageLabel')}
        hideLabel
        value={targetLanguageCode}
        onChange={(e) => setAppSettings((prev) => ({ ...prev, liveTranslateTargetLanguageCode: e.target.value }))}
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
      <button
        type="button"
        onClick={() => setAppSettings((prev) => ({ ...prev, liveTranslateEchoTargetLanguage: !prev.liveTranslateEchoTargetLanguage }))}
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 mb-2
          ${
            echoTargetLanguage
              ? 'bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] border border-[var(--theme-border-secondary)]'
              : 'text-[var(--theme-text-tertiary)] hover:bg-[var(--theme-bg-secondary)]/50'
          }
        `}
        title={t('liveTranslateEchoTargetLanguageTooltip')}
        aria-pressed={echoTargetLanguage}
      >
        <Volume2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
};
