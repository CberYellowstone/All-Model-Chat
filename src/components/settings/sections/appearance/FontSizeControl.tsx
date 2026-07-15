import React from 'react';
import { Type } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { type AppSettings } from '@/types';
import {
  SETTINGS_SECTION_CARD_CLASS,
  SETTINGS_SECTION_LABEL_CLASS,
  SETTINGS_VALUE_BADGE_CLASS,
} from '@/constants/designTokens';

interface FontSizeControlProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const FontSizeControl: React.FC<FontSizeControlProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  return (
    <div className={`${SETTINGS_SECTION_CARD_CLASS} space-y-4`}>
      <div className="flex items-center justify-between">
        <label className={`${SETTINGS_SECTION_LABEL_CLASS} flex items-center gap-2`}>
          <Type size={14} strokeWidth={1.5} /> {t('settingsFontSize')}
        </label>
        <span className={SETTINGS_VALUE_BADGE_CLASS}>{settings.baseFontSize}px</span>
      </div>
      <input
        type="range"
        min="12"
        max="24"
        step="1"
        value={settings.baseFontSize}
        onChange={(e) => onUpdate('baseFontSize', parseInt(e.target.value, 10))}
        className="w-full h-1.5 bg-[var(--theme-border-secondary)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-bg-accent)] hover:accent-[var(--theme-bg-accent-hover)]"
      />
      <div className="flex justify-between text-xs text-[var(--theme-text-tertiary)] font-mono px-1">
        <span>12px</span>
        <span>18px</span>
        <span>24px</span>
      </div>
    </div>
  );
};
