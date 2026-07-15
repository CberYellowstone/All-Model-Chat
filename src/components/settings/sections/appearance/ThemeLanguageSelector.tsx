import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { type AppSettings } from '@/types';
import {
  SETTINGS_SECTION_CARD_CLASS,
  SETTINGS_SEGMENTED_ACTIVE_CLASS,
  SETTINGS_SEGMENTED_IDLE_CLASS,
  SETTINGS_SEGMENTED_TRACK_CLASS,
} from '@/constants/designTokens';

interface ThemeLanguageSelectorProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const ThemeLanguageSelector: React.FC<ThemeLanguageSelectorProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const themeOptions = [
    { id: 'system', labelKey: 'settingsThemeSystem' },
    { id: 'onyx', labelKey: 'settingsThemeDark' },
    { id: 'graphite', labelKey: 'settingsThemeGray' },
    { id: 'pearl', labelKey: 'settingsThemeLight' },
  ] as const;

  const languageOptions = [
    { id: 'system', label: t('settingsLanguageSystem') },
    { id: 'en', label: t('settingsLanguageEn') },
    { id: 'zh', label: t('settingsLanguageZh') },
  ] as const;

  return (
    <div className={`${SETTINGS_SECTION_CARD_CLASS} space-y-1`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-1">
        <span className="text-sm font-medium text-[var(--theme-text-primary)]">{t('settingsTheme')}</span>
        <div className={`${SETTINGS_SEGMENTED_TRACK_CLASS} flex-wrap`} role="group" aria-label={t('settingsTheme')}>
          {themeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onUpdate('themeId', option.id)}
              className={
                settings.themeId === option.id ? SETTINGS_SEGMENTED_ACTIVE_CLASS : SETTINGS_SEGMENTED_IDLE_CLASS
              }
              title={t(option.labelKey)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--theme-border-secondary)]/50 py-3">
        <span className="text-sm font-medium text-[var(--theme-text-primary)]">{t('settingsLanguage')}</span>
        <div
          className={SETTINGS_SEGMENTED_TRACK_CLASS}
          role="group"
          aria-label={t('settingsLanguage')}
        >
          {languageOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onUpdate('language', option.id as AppSettings['language'])}
              className={
                settings.language === option.id ? SETTINGS_SEGMENTED_ACTIVE_CLASS : SETTINGS_SEGMENTED_IDLE_CLASS
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
