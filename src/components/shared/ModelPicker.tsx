import { useI18n } from '@/contexts/I18nContext';
import React, { useMemo, useRef, useState, type RefObject } from 'react';
import { type ModelOption } from '@/types';
import { Check } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import {
  buildModelCatalog,
  buildModelCatalogSections,
  filterModelCatalog,
  getModelProviderSectionLabelKey,
} from '@/utils/modelCatalog';
import { getModelIcon } from './ModelIcon';

interface ModelPickerProps {
  models: ModelOption[];
  selectedId: string;
  onSelect: (modelId: string) => void;

  // Render props for the trigger button
  renderTrigger: (props: {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    selectedModel: ModelOption | undefined;
    ref: RefObject<HTMLDivElement>;
  }) => React.ReactNode;

  dropdownClassName?: string;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  models,
  selectedId,
  onSelect,
  renderTrigger,
  dropdownClassName,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const catalog = useMemo(() => buildModelCatalog(models), [models]);
  const filteredEntries = useMemo(() => filterModelCatalog(catalog, ''), [catalog]);

  const selectedModel = models.find((m) => m.id === selectedId);

  const sections = useMemo(() => buildModelCatalogSections(filteredEntries), [filteredEntries]);

  const handleSelectModel = (modelId: string) => {
    onSelect(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {renderTrigger({
        isOpen,
        setIsOpen,
        selectedModel,
        ref: containerRef,
      })}

      {isOpen && (
        <div
          className={`absolute top-full left-0 mt-1 bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-xl shadow-premium z-50 flex flex-col modal-enter-animation overflow-hidden ${dropdownClassName || 'w-full min-w-[280px] max-h-[300px]'}`}
        >
          {!models.length ? (
            <div className="p-4 text-center">
              <p className="text-xs text-[var(--theme-text-tertiary)] mt-2">{t('appNoModelsAvailable')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-y-auto custom-scrollbar p-1.5 flex-grow space-y-2" role="listbox">
                {sections.length === 0 ? (
                  <div className="px-3 py-5 text-center text-xs text-[var(--theme-text-tertiary)]">
                    {t('modelPickerNoResults')}
                  </div>
                ) : (
                  sections.map((section) => (
                    <div key={section.key} className="space-y-1" data-provider-section={section.providerKey}>
                      {section.providerKey && (
                        <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--theme-text-tertiary)]">
                          {t(getModelProviderSectionLabelKey(section.providerKey))}
                        </div>
                      )}
                      {section.entries.map((entry) => {
                        const isSelected = entry.id === selectedId;

                        return (
                          <button
                            key={entry.id}
                            id={`model-picker-option-${entry.id}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => handleSelectModel(entry.id)}
                            className={`group w-full text-left px-3 py-2.5 text-sm rounded-xl flex items-start justify-between transition-colors cursor-pointer outline-none border ${
                              isSelected
                                ? 'bg-[var(--theme-bg-tertiary)]/60 border-[var(--theme-border-secondary)]'
                                : 'bg-transparent border-transparent hover:bg-[var(--theme-bg-tertiary)] hover:border-[var(--theme-border-secondary)]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-grow overflow-hidden">
                              <div className="mt-0.5 flex-shrink-0">{getModelIcon(entry.model)}</div>
                              <div className="min-w-0 flex-grow">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`truncate ${isSelected ? 'text-[var(--theme-text-link)] font-semibold' : 'text-[var(--theme-text-primary)]'}`}
                                    title={entry.name}
                                  >
                                    {entry.name}
                                  </span>
                                </div>
                                <div className="mt-1 truncate font-mono text-[10px] text-[var(--theme-text-tertiary)]">
                                  {entry.id}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0 pl-3 pt-0.5">
                              {isSelected && (
                                <Check size={14} className="text-[var(--theme-text-link)]" strokeWidth={1.5} />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
