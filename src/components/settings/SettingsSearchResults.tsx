import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_SECTION_CARD_CLASS } from '@/constants/designTokens';
import type { SettingsSearchResult } from '@/utils/settingsSearch';

interface SettingsSearchResultsProps {
  results: SettingsSearchResult[];
  onSelect: (result: SettingsSearchResult) => void;
  selectedIndex?: number;
}

export const SettingsSearchResults: React.FC<SettingsSearchResultsProps> = ({ results, onSelect, selectedIndex }) => {
  const { t } = useI18n();

  if (results.length === 0) {
    return (
      <div className={`${SETTINGS_SECTION_CARD_CLASS} text-sm text-[var(--theme-text-tertiary)]`}>
        {t('settingsSearchNoResults')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-[var(--theme-text-tertiary)]">
        {t('settingsSearchResultsCount').replace('{count}', String(results.length))}
      </p>
      <ul className={`${SETTINGS_SECTION_CARD_CLASS} divide-y divide-[var(--theme-border-secondary)]/40 p-0`}>
        {results.map((result, index) => {
          const isSelected = selectedIndex === index;

          return (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                aria-selected={isSelected}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--theme-bg-tertiary)]/50 focus:outline-none focus-visible:bg-[var(--theme-bg-tertiary)]/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-border-focus)] ${
                  isSelected ? 'bg-[var(--theme-bg-tertiary)]/75 ring-2 ring-inset ring-[var(--theme-border-focus)]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  {result.groupLabel && (
                    <span className="mb-0.5 block text-xs font-medium uppercase tracking-wide text-[var(--theme-text-tertiary)]">
                      {result.groupLabel}
                    </span>
                  )}
                  <span className="block text-sm font-medium text-[var(--theme-text-primary)]">{result.label}</span>
                  {result.description && (
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-[var(--theme-text-tertiary)]">
                      {result.description}
                    </span>
                  )}
                </div>
                <ChevronRight
                  size={16}
                  strokeWidth={1.75}
                  className="mt-0.5 flex-shrink-0 text-[var(--theme-text-tertiary)]"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
