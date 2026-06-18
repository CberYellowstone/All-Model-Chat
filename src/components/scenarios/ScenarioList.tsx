import React, { useMemo, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { type SavedScenario, type ScenarioCategory } from '@/types';
import { Search, User, Library, Inbox } from 'lucide-react';
import { ScenarioItem } from './ScenarioItem';
import { CATEGORY_META, CATEGORY_ORDER, getCategory } from '@/features/scenarios/scenarioCategories';

interface ScenarioListProps {
  scenarios: SavedScenario[];
  /** Read-only system presets (cannot be edited/deleted). */
  systemScenarioIds: string[];
  /** Everything shipped with the app, including seeded user presets. Drives the Built-in / Mine split. */
  builtInScenarioIds: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onLoad: (scenario: SavedScenario) => void;
  onEdit: (scenario: SavedScenario) => void;
  onDelete: (id: string) => void;
  onDuplicate: (scenario: SavedScenario) => void;
  onExport: (scenario: SavedScenario) => void;
  onView?: (scenario: SavedScenario) => void;
}

type OwnerScope = 'mine' | 'builtin';

export const ScenarioList: React.FC<ScenarioListProps> = ({
  scenarios,
  systemScenarioIds,
  builtInScenarioIds,
  searchQuery,
  setSearchQuery,
  onLoad,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onView,
}) => {
  const { t } = useI18n();
  // Default to "mine" when the user has authored scenarios, otherwise land on the
  // built-in presets so a fresh install never shows an empty library first.
  const hasCustomScenarios = scenarios.some((scenario) => !builtInScenarioIds.includes(scenario.id));
  const [ownerScope, setOwnerScope] = useState<OwnerScope>(hasCustomScenarios ? 'mine' : 'builtin');
  const [activeCategory, setActiveCategory] = useState<ScenarioCategory | 'all'>('all');

  // Only show category chips that actually have scenarios within the current scope.
  const availableCategories = useMemo(() => {
    const present = new Set<ScenarioCategory>();
    const builtInSet = new Set(builtInScenarioIds);
    const inScope = (scenario: SavedScenario) => builtInSet.has(scenario.id) === (ownerScope === 'builtin');
    scenarios.forEach((scenario) => {
      if (inScope(scenario)) {
        present.add(getCategory(scenario.category));
      }
    });
    return CATEGORY_ORDER.filter((category) => present.has(category));
  }, [scenarios, ownerScope, builtInScenarioIds]);

  // If the active category is no longer represented, reset to "all".
  const effectiveCategory =
    activeCategory === 'all' || availableCategories.includes(activeCategory) ? activeCategory : 'all';

  const filteredScenarios = useMemo(() => {
    const builtInSet = new Set(builtInScenarioIds);
    const inScope = (scenario: SavedScenario) => builtInSet.has(scenario.id) === (ownerScope === 'builtin');
    let list = scenarios.filter(inScope);

    if (effectiveCategory !== 'all') {
      list = list.filter((scenario) => getCategory(scenario.category) === effectiveCategory);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      list = list.filter(
        (scenario) =>
          scenario.title.toLowerCase().includes(lowerQuery) ||
          (scenario.description && scenario.description.toLowerCase().includes(lowerQuery)) ||
          scenario.messages.some((message) => message.content.toLowerCase().includes(lowerQuery)) ||
          (scenario.systemInstruction && scenario.systemInstruction.toLowerCase().includes(lowerQuery)),
      );
    }

    return list;
  }, [scenarios, searchQuery, effectiveCategory, ownerScope, builtInScenarioIds]);

  const ownerTabs: { id: OwnerScope; labelKey: string; icon: React.ElementType }[] = [
    { id: 'mine', labelKey: 'scenariosTabMine', icon: User },
    { id: 'builtin', labelKey: 'scenariosCategorySystem', icon: Library },
  ];

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4">
      <div className="relative group flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--theme-text-tertiary)] group-focus-within:text-[var(--theme-text-primary)] transition-colors">
          <Search size={18} />
        </div>
        <input
          type="text"
          placeholder={t('historySearchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-[var(--theme-bg-input)] border border-[var(--theme-border-secondary)] rounded-xl text-sm font-medium text-[var(--theme-text-primary)] placeholder-[var(--theme-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)] focus:border-transparent transition-all shadow-sm"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-shrink-0">
        <div className="flex p-1 bg-[var(--theme-bg-input)] border border-[var(--theme-border-secondary)] rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
          {ownerTabs.map((tab) => {
            const isActive = ownerScope === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setOwnerScope(tab.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--theme-bg-primary)] text-[var(--theme-text-link)] shadow-sm'
                    : 'text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {availableCategories.length > 0 && (
          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
            role="group"
            aria-label={t('scenariosCategoryAria')}
          >
            <CategoryChip
              active={effectiveCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              label={t('scenariosFilterAll')}
            />
            {availableCategories.map((category) => {
              const meta = CATEGORY_META[category];
              return (
                <CategoryChip
                  key={category}
                  active={effectiveCategory === category}
                  onClick={() => setActiveCategory(category)}
                  label={t(meta.labelKey)}
                  chipClass={meta.chipClass}
                  emoji={meta.emoji}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 pb-4 min-h-0">
        {filteredScenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--theme-text-tertiary)]">
            <div className="p-4 rounded-full bg-[var(--theme-bg-input)] mb-4">
              <Inbox size={48} className="opacity-30" strokeWidth={1} />
            </div>
            <p className="text-base font-medium text-[var(--theme-text-secondary)]">{t('scenariosEmptySearch')}</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[var(--theme-text-link)] hover:underline text-sm"
              >
                {t('scenariosClearSearch')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {filteredScenarios.map((scenario) => {
              const isSystem = systemScenarioIds.includes(scenario.id);
              return (
                <ScenarioItem
                  key={scenario.id}
                  scenario={scenario}
                  isSystem={isSystem}
                  onLoad={onLoad}
                  onEdit={isSystem ? undefined : onEdit}
                  onDelete={isSystem ? undefined : onDelete}
                  onDuplicate={onDuplicate}
                  onExport={onExport}
                  onView={isSystem ? onView : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const CategoryChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  chipClass?: string;
  emoji?: string;
}> = ({ active, onClick, label, chipClass, emoji }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
      active
        ? chipClass
          ? `${chipClass} border-transparent`
          : 'bg-[var(--theme-bg-accent)] text-[var(--theme-text-accent)] border-transparent'
        : 'bg-[var(--theme-bg-input)] border-[var(--theme-border-secondary)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-border-focus)]'
    }`}
  >
    {emoji && <span aria-hidden="true">{emoji}</span>}
    {label}
  </button>
);
