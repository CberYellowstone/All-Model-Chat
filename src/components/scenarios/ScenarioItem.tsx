import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { type SavedScenario } from '@/types';
import { Download, Edit3, Trash2, Eye, Copy, Sparkles, MoreVertical, Play } from 'lucide-react';
import { SMALL_ICON_BUTTON_CLASS } from '@/constants/buttonClasses';
import { getCategoryMeta } from '@/features/scenarios/scenarioCategories';
import {
  MENU_ITEM_BUTTON_CLASS,
  MENU_ITEM_DEFAULT_STATE_CLASS,
  MENU_ITEM_DANGER_STATE_CLASS,
} from '@/constants/menuClasses';

interface ScenarioItemProps {
  scenario: SavedScenario;
  isSystem: boolean;
  onLoad: (scenario: SavedScenario) => void;
  onEdit?: (scenario: SavedScenario) => void;
  onDelete?: (id: string) => void;
  onDuplicate: (scenario: SavedScenario) => void;
  onExport: (scenario: SavedScenario) => void;
  onView?: (scenario: SavedScenario) => void;
}

export const ScenarioItem: React.FC<ScenarioItemProps> = ({
  scenario,
  isSystem,
  onLoad,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onView,
}) => {
  const { t } = useI18n();
  const messageCount = scenario.messages.length;
  const hasSystemPrompt = !!scenario.systemInstruction;

  const meta = getCategoryMeta(scenario.category);
  const CategoryIcon = meta.icon;
  // Show the scenario emoji when provided, otherwise fall back to the category icon.
  const displayGlyph = scenario.emoji ? null : <CategoryIcon size={18} strokeWidth={2} />;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  // Card preview prefers a human description; only fall back to content when absent.
  const previewText =
    scenario.description ||
    (scenario.messages.length > 0
      ? scenario.messages[0].content
      : scenario.systemInstruction || t('scenariosPreviewFallback'));

  const secondaryActions: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    onSelect: () => void;
    danger?: boolean;
  }> = [];

  if (isSystem && onView) {
    secondaryActions.push({
      key: 'view',
      label: t('scenariosViewTitle'),
      icon: Eye,
      onSelect: () => onView(scenario),
    });
  }
  if (!isSystem && onEdit) {
    secondaryActions.push({
      key: 'edit',
      label: t('scenariosEditTitle'),
      icon: Edit3,
      onSelect: () => onEdit(scenario),
    });
  }
  secondaryActions.push({
    key: 'duplicate',
    label: t('scenariosDuplicateTitle'),
    icon: Copy,
    onSelect: () => onDuplicate(scenario),
  });
  secondaryActions.push({
    key: 'export',
    label: t('scenariosExportSingleTitle'),
    icon: Download,
    onSelect: () => onExport(scenario),
  });
  if (!isSystem && onDelete) {
    secondaryActions.push({
      key: 'delete',
      label: t('scenariosDeleteTitle'),
      icon: Trash2,
      onSelect: () => onDelete(scenario.id),
      danger: true,
    });
  }

  const editAction = !isSystem && onEdit ? () => onEdit(scenario) : null;

  return (
    <div
      className="
        group relative flex flex-col h-full overflow-hidden
        bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)]
        rounded-xl transition-all duration-200
        hover:border-[var(--theme-border-focus)] hover:shadow-md
      "
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${meta.barClass} opacity-70 group-hover:opacity-100 transition-opacity`}
        aria-hidden="true"
      />

      <div className="flex flex-col h-full pl-5 pr-4 py-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${meta.chipClass}`}
          >
            {scenario.emoji ? <span aria-hidden="true">{scenario.emoji}</span> : displayGlyph}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="font-semibold text-sm text-[var(--theme-text-primary)] truncate leading-snug"
              title={scenario.title}
            >
              {scenario.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--theme-text-tertiary)] mt-1">
              <span>{t('scenariosMessageCount').replace('{count}', String(messageCount))}</span>
              {hasSystemPrompt && (
                <span className="flex items-center gap-1 text-[var(--theme-text-secondary)]">
                  <Sparkles size={11} /> {t('scenariosHasSystemPrompt')}
                </span>
              )}
              {isSystem && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${meta.chipClass}`}
                >
                  {t(meta.labelKey)}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onLoad(scenario)}
          className="flex-grow text-left mb-3 cursor-pointer"
          title={t('scenariosUseButtonTitle')}
          aria-label={`${t('scenariosUseButton')} ${scenario.title}`}
        >
          <p className="text-xs text-[var(--theme-text-secondary)] leading-relaxed line-clamp-3 opacity-80 group-hover:opacity-100 transition-opacity">
            {previewText}
          </p>
        </button>

        <div className="flex items-center gap-2 pt-3 mt-auto border-t border-[var(--theme-border-secondary)]/50">
          <button
            type="button"
            onClick={() => onLoad(scenario)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--theme-bg-accent)] hover:bg-[var(--theme-bg-accent-hover)] text-[var(--theme-text-accent)] rounded-lg font-semibold text-xs transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            title={t('scenariosUseButtonTitle')}
          >
            <Play size={13} strokeWidth={2.5} />
            {t('scenariosUseButton')}
          </button>

          {editAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                editAction();
              }}
              className={SMALL_ICON_BUTTON_CLASS}
              title={t('scenariosEditTitle')}
              aria-label={t('scenariosEditTitle')}
            >
              <Edit3 size={15} />
            </button>
          )}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((open) => !open);
              }}
              className={SMALL_ICON_BUTTON_CLASS}
              title={t('scenariosMoreActions')}
              aria-label={t('scenariosActionsAria')}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical size={15} />
            </button>
            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 bottom-full mb-1 z-20 w-44 bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-150"
              >
                {secondaryActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        action.onSelect();
                      }}
                      className={`${MENU_ITEM_BUTTON_CLASS} ${action.danger ? MENU_ITEM_DANGER_STATE_CLASS : MENU_ITEM_DEFAULT_STATE_CLASS}`}
                    >
                      <ActionIcon size={14} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
