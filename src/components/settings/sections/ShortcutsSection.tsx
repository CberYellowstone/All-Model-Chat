import React, { useCallback, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { SHORTCUT_REGISTRY, DEFAULT_SHORTCUTS } from '@/constants/shortcuts';
import { SETTINGS_SECTION_CARD_CLASS, SETTINGS_SECTION_LABEL_CLASS } from '@/constants/designTokens';
import { type AppSettings, type ModelOption } from '@/types';
import { ShortcutRecorder } from './shortcuts/ShortcutRecorder';
import { TabCycleModelsCard } from './TabCycleModelsCard';

interface ShortcutsSectionProps {
  currentSettings?: AppSettings;
  availableModels?: ModelOption[];
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
}

export const ShortcutsSection: React.FC<ShortcutsSectionProps> = ({
  currentSettings,
  availableModels = [],
  onUpdateSettings,
}) => {
  const { t } = useI18n();
  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, typeof SHORTCUT_REGISTRY> = {};
    SHORTCUT_REGISTRY.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, []);

  const categoryTitles: Record<string, string> = {
    general: 'shortcutsGeneralTitle',
    input: 'shortcutsChatInputTitle',
    global: 'shortcutsGlobalTitle',
  };

  const handleShortcutChange = useCallback(
    (id: string, newKey: string) => {
      if (!currentSettings || !onUpdateSettings) return;

      const updatedShortcuts = { ...currentSettings.customShortcuts };

      if (newKey === DEFAULT_SHORTCUTS[id]) {
        // If setting back to default, remove from custom map to keep it clean
        delete updatedShortcuts[id];
      } else {
        updatedShortcuts[id] = newKey;
      }

      onUpdateSettings({ customShortcuts: updatedShortcuts });
    },
    [currentSettings, onUpdateSettings],
  );

  // Show a read-only fallback when settings callbacks are unavailable.
  if (!currentSettings || !onUpdateSettings) {
    return <div className="p-4 text-center text-[var(--theme-text-tertiary)]">{t('shortcutsUnavailable')}</div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {Object.entries(groupedShortcuts).map(([category, items]) => (
        <div
          key={category}
          className={SETTINGS_SECTION_CARD_CLASS}
          data-settings-item={`shortcuts-${category}`}
        >
          <h4 className={`${SETTINGS_SECTION_LABEL_CLASS} mb-2`}>
            {t(categoryTitles[category] || category)}
          </h4>

          <div className="divide-y divide-[var(--theme-border-secondary)]/40">
            {items.map((item) => {
              const customKey = currentSettings.customShortcuts?.[item.id];
              const effectiveKey = customKey !== undefined ? customKey : item.defaultKey;

              return (
                <React.Fragment key={item.id}>
                  <div className="py-3 group" data-settings-item={`shortcut-${item.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-[var(--theme-text-primary)] group-hover:text-[var(--theme-text-primary)] transition-colors">
                          {t(item.labelKey)}
                        </span>
                      </div>
                      <ShortcutRecorder
                        value={effectiveKey}
                        defaultValue={item.defaultKey}
                        onChange={(shortcut) => handleShortcutChange(item.id, shortcut)}
                      />
                    </div>
                  </div>
                  {item.id === 'input.cycleModels' && (
                    <div className="pb-3 pt-1">
                      <TabCycleModelsCard
                        availableModels={availableModels}
                        configuredIds={currentSettings.tabModelCycleIds}
                        onChange={(tabModelCycleIds) => onUpdateSettings({ tabModelCycleIds })}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
