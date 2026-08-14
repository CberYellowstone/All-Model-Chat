import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { LayoutGrid } from 'lucide-react';
import { TOOLBAR_TOGGLE_ACTIVE_CLASS, TOOLBAR_TOGGLE_IDLE_CLASS } from '@/constants/designTokens';

interface QuadImageToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export const QuadImageToggle: React.FC<QuadImageToggleProps> = ({ enabled, onToggle }) => {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={enabled ? TOOLBAR_TOGGLE_ACTIVE_CLASS : TOOLBAR_TOGGLE_IDLE_CLASS}
      title={t('settingsGenerateQuadImagesTooltip')}
      aria-label={t('quadImagesLabel')}
    >
      <LayoutGrid size={14} strokeWidth={2} />
      <span>{t('quadImagesLabel')}</span>
    </button>
  );
};
