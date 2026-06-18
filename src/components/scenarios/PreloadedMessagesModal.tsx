import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { type SavedScenario } from '@/types';
import { X, Plus, Upload, Download, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { ScenarioEditor } from './ScenarioEditor';
import { ScenarioList } from './ScenarioList';
import { useScenarioManager } from '@/hooks/scenarios/useScenarioManager';
import {
  MODAL_CLOSE_BUTTON_DANGER_HOVER_CLASS,
  SMALL_ICON_BUTTON_ROUND_CLASS,
  ICON_BUTTON_CLASS,
} from '@/constants/buttonClasses';
import { MENU_ITEM_BUTTON_CLASS, MENU_ITEM_DEFAULT_STATE_CLASS } from '@/constants/menuClasses';

interface PreloadedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedScenarios: SavedScenario[];
  onSaveAllScenarios: (scenarios: SavedScenario[]) => void;
  onLoadScenario: (scenario: SavedScenario) => void;
}

const CLOSE_BUTTON_AUTO_FOCUS_DELAY_MS = 100;
const SCENARIO_LOAD_CLOSE_DELAY_MS = 300;

type ConfirmState = { kind: 'close' } | { kind: 'delete'; id: string } | { kind: 'none' };

export const PreloadedMessagesModal: React.FC<PreloadedMessagesModalProps> = ({
  isOpen,
  onClose,
  savedScenarios,
  onSaveAllScenarios,
  onLoadScenario,
}) => {
  const { t } = useI18n();
  const {
    scenarios,
    view,
    editingScenario,
    searchQuery,
    setSearchQuery,
    feedback,
    importInputRef,
    systemScenarioIds,
    builtInScenarioIds,
    hasUnsavedChanges,
    showFeedback,
    actions,
  } = useScenarioManager({
    isOpen,
    savedScenarios,
    onSaveAllScenarios,
    onClose,
    t,
  });

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const delayedCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [confirm, setConfirm] = useState<ConfirmState>({ kind: 'none' });
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const clearDelayedCloseTimeout = useCallback(() => {
    if (delayedCloseTimeoutRef.current !== null) {
      clearTimeout(delayedCloseTimeoutRef.current);
      delayedCloseTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => closeButtonRef.current?.focus(), CLOSE_BUTTON_AUTO_FOCUS_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => () => clearDelayedCloseTimeout(), [clearDelayedCloseTimeout]);

  useEffect(() => {
    if (!isMoreMenuOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset of ephemeral UI state when the modal closes.
      setConfirm({ kind: 'none' });
      setIsMoreMenuOpen(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    clearDelayedCloseTimeout();
    if (!isOpen) return;
    if (hasUnsavedChanges) {
      setIsMoreMenuOpen(false);
      setConfirm({ kind: 'close' });
      return;
    }
    onClose();
  };

  const handleLoadAndClose = (scenario: SavedScenario) => {
    if (scenario.messages.length === 0 && !scenario.systemInstruction?.trim()) {
      showFeedback('error', t('scenariosFeedbackEmpty'));
      return;
    }
    onLoadScenario(scenario);
    showFeedback('success', t('scenariosFeedbackLoaded'));
    clearDelayedCloseTimeout();
    delayedCloseTimeoutRef.current = setTimeout(() => {
      delayedCloseTimeoutRef.current = null;
      onClose();
    }, SCENARIO_LOAD_CLOSE_DELAY_MS);
  };

  const requestDelete = (id: string) => {
    setIsMoreMenuOpen(false);
    setConfirm({ kind: 'delete', id });
  };

  const handleConfirm = () => {
    if (confirm.kind === 'close') {
      onClose();
    } else if (confirm.kind === 'delete') {
      actions.handleDeleteScenario(confirm.id);
    }
    setConfirm({ kind: 'none' });
  };

  const confirmConfig =
    confirm.kind === 'close'
      ? {
          title: t('scenariosConfirmCloseTitle'),
          message: t('scenariosConfirmCloseMessage'),
          confirmLabel: t('scenariosConfirmCloseConfirm'),
          isDanger: true,
        }
      : confirm.kind === 'delete'
        ? {
            title: t('scenariosConfirmDeleteTitle'),
            message: t('scenariosConfirmDeleteMessage'),
            confirmLabel: t('delete'),
            isDanger: true,
          }
        : null;

  const isSystemScenario = editingScenario && systemScenarioIds.includes(editingScenario.id);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      noPadding
      ariaLabelledBy="scenarios-title"
      contentClassName="w-full h-full sm:w-[95vw] sm:h-[90vh] sm:max-w-7xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden bg-[var(--theme-bg-primary)] border border-[var(--theme-border-primary)] transition-all"
    >
      <div className="flex flex-col h-full relative">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 bg-[var(--theme-bg-primary)] flex-shrink-0 z-10 border-b border-[var(--theme-border-secondary)]/50">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {view === 'editor' && (
              <button
                onClick={actions.handleCancelEdit}
                className={`${SMALL_ICON_BUTTON_ROUND_CLASS} -ml-2 text-[var(--theme-text-secondary)]`}
                aria-label={t('scenariosEditorBack')}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2
              id="scenarios-title"
              className="text-xl sm:text-2xl font-bold text-[var(--theme-text-primary)] tracking-tight truncate"
            >
              {view === 'editor' ? editingScenario?.title || t('scenariosTitleCreate') : t('scenariosTitle')}
            </h2>
            {view === 'editor' && (
              <span
                className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${isSystemScenario ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-[var(--theme-bg-accent)]/10 text-[var(--theme-bg-accent)] border-[var(--theme-bg-accent)]/20'}`}
              >
                {isSystemScenario ? t('scenariosSystemPresetReadonlyBadge') : t('scenariosEditorBadge')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {view === 'list' && (
              <>
                <button
                  onClick={actions.handleStartAddNew}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold bg-[var(--theme-bg-accent)] hover:bg-[var(--theme-bg-accent-hover)] text-[var(--theme-text-accent)] rounded-xl transition-colors flex items-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span className="hidden sm:inline">{t('scenariosCreateButton')}</span>
                  <span className="sm:hidden">{t('add')}</span>
                </button>

                <button
                  onClick={actions.handleSaveAllAndClose}
                  disabled={!hasUnsavedChanges}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] text-[var(--theme-text-primary)] rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--theme-bg-tertiary)]"
                  title={t('scenariosSaveAndCloseTitle')}
                >
                  <span>{t('scenariosSaveAll')}</span>
                </button>

                <div className="relative sm:hidden" ref={moreMenuRef}>
                  <button
                    onClick={() => setIsMoreMenuOpen((open) => !open)}
                    className={ICON_BUTTON_CLASS}
                    aria-label={t('scenariosMoreActions')}
                    aria-haspopup="menu"
                    aria-expanded={isMoreMenuOpen}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {isMoreMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 z-20 w-40 bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] rounded-md shadow-lg py-1"
                    >
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          importInputRef.current?.click();
                        }}
                        className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}
                      >
                        <Upload size={14} /> <span>{t('import')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          actions.handleExportScenarios();
                        }}
                        className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}
                      >
                        <Download size={14} /> <span>{t('export')}</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => importInputRef.current?.click()}
                  className="hidden sm:block p-2 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] rounded-xl transition-colors"
                  title={t('import')}
                  aria-label={t('import')}
                >
                  <Upload size={20} />
                </button>
                <input
                  type="file"
                  ref={importInputRef}
                  onChange={actions.handleImportScenarios}
                  accept=".json"
                  className="hidden"
                />

                <button
                  onClick={actions.handleExportScenarios}
                  className="hidden sm:block p-2 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] rounded-xl transition-colors"
                  title={t('export')}
                  aria-label={t('export')}
                >
                  <Download size={20} />
                </button>
              </>
            )}

            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className={`${MODAL_CLOSE_BUTTON_DANGER_HOVER_CLASS} rounded-xl`}
              aria-label={t('scenariosCloseAria')}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {feedback && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
            <div
              className={`px-5 py-2.5 rounded-full text-sm font-semibold shadow-xl border flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-[var(--theme-bg-success)] text-[var(--theme-text-success)] border-[var(--theme-text-success)]/20'
                  : feedback.type === 'error'
                    ? 'bg-[var(--theme-bg-error)] text-[var(--theme-text-danger)] border-[var(--theme-text-danger)]/20'
                    : 'bg-[var(--theme-bg-info)] text-[var(--theme-text-info)] border-[var(--theme-text-info)]/20'
              }`}
            >
              {feedback.message}
            </div>
          </div>
        )}

        <div className="flex-grow flex flex-col min-h-0 bg-[var(--theme-bg-secondary)] p-3 sm:p-4 md:px-6 md:py-5 overflow-hidden">
          {view === 'list' ? (
            <ScenarioList
              scenarios={scenarios}
              systemScenarioIds={systemScenarioIds}
              builtInScenarioIds={builtInScenarioIds}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onLoad={handleLoadAndClose}
              onEdit={actions.handleStartEdit}
              onDelete={requestDelete}
              onDuplicate={actions.handleDuplicateScenario}
              onExport={actions.handleExportSingleScenario}
              onView={actions.handleStartEdit}
            />
          ) : (
            <ScenarioEditor
              initialScenario={editingScenario}
              onSave={actions.handleSaveScenario}
              readOnly={!!isSystemScenario}
            />
          )}
        </div>
      </div>

      {confirmConfig && (
        <ConfirmationModal
          isOpen
          onClose={() => setConfirm({ kind: 'none' })}
          onConfirm={handleConfirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={t('cancel')}
          isDanger={confirmConfig.isDanger}
        />
      )}
    </Modal>
  );
};
