import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface ThinkingStripProps {
  lastThought: { title: string; content: string; isFallback: boolean } | null;
}

export const ThinkingStrip: React.FC<ThinkingStripProps> = ({ lastThought }) => {
  const { t } = useI18n();
  if (!lastThought) return null;

  const displayTitle = lastThought.isFallback ? t('thinkingLatestStep') : lastThought.title;

  return (
    <div
      data-thinking-strip="true"
      className="mx-3 mb-2 mt-1 flex items-start gap-2 rounded-md border border-[var(--theme-border-secondary)]/50 border-l-[3px] border-l-[var(--theme-text-success)] bg-[var(--theme-bg-input)]/50 p-2"
    >
      <span
        aria-hidden="true"
        className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--theme-text-success)] text-[var(--theme-text-success)] animate-pulse shadow-[0_0_8px_currentColor]"
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[var(--theme-text-primary)]">{displayTitle}</span>
        {lastThought.content && (
          <span className="mt-0.5 block text-xs leading-normal text-[var(--theme-text-tertiary)] line-clamp-2">
            {lastThought.content}
          </span>
        )}
      </div>
    </div>
  );
};
