import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { type AppSettings, type ChatSettings, type ModelOption } from '@/types';
import { Modal } from '@/components/shared/Modal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { useSettingsLogic } from '@/hooks/settings/useSettingsLogic';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';
import { SettingsSearchResults } from './SettingsSearchResults';
import { type SettingsTransferProps } from './settingsTypes';
import type { LogViewerProps } from '@/components/log-viewer/LogViewer';
import {
  buildSettingsForModal,
  type SettingsScope,
  splitScopedSettingsUpdate,
} from '@/components/layout/mainContentModels';
import { useSettingsTransferActions } from '@/hooks/data-management/useSettingsTransferActions';
import { X } from 'lucide-react';
import {
  SETTINGS_SEGMENTED_ACTIVE_CLASS,
  SETTINGS_SEGMENTED_IDLE_CLASS,
  SETTINGS_SEGMENTED_TRACK_CLASS,
} from '@/constants/designTokens';
import { MODAL_CLOSE_BUTTON_CLASS } from '@/constants/buttonClasses';
import type { SettingsTab } from '@/stores/settingsUiStore';
import { searchSettingsCatalog, type SettingsSearchResult } from '@/utils/settingsSearch';

const SETTINGS_FOCUS_HIGHLIGHT_CLASSES = [
  'ring-2',
  'ring-[var(--theme-border-focus)]',
  'ring-offset-2',
  'ring-offset-[var(--theme-bg-primary)]',
  'rounded-xl',
] as const;

interface SettingsModalProps extends SettingsTransferProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings;
  currentThemeId: string;
  currentChatSettings?: ChatSettings;
  hasActiveSession?: boolean;
  availableModels: ModelOption[];
  onSave: (newSettings: AppSettings) => void;
  onSaveCurrentChatSettings?: (newSettings: ChatSettings) => void;
  onClearAllHistory: () => void;
  onClearCache: () => void;
  onOpenLogViewer: (state?: Pick<LogViewerProps, 'initialTab' | 'initialUsageTab'>) => void;
  setAvailableModels: (models: ModelOption[]) => void;
  onImportSettings?: (file: File) => void;
  onExportSettings?: () => void;
  onImportHistory?: (file: File) => void;
  onExportHistory?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  currentThemeId,
  currentChatSettings,
  hasActiveSession = false,
  availableModels,
  onSave,
  onSaveCurrentChatSettings,
  onClearAllHistory,
  onClearCache,
  onOpenLogViewer,
  onInstallPwa,
  installState,
  onImportScenarios,
  onExportScenarios,
  setAvailableModels,
}) => {
  const { t } = useI18n();
  const [liveSettings, setLiveSettings] = useState(currentSettings);
  const [liveCurrentChatSettings, setLiveCurrentChatSettings] = useState(currentChatSettings);
  const [settingsScope, setSettingsScope] = useState<SettingsScope>('defaults');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const canEditCurrentChat = hasActiveSession && !!liveCurrentChatSettings && !!onSaveCurrentChatSettings;
  const chatScopedTabs = useMemo(() => new Set(['models']), []);
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    setLiveSettings(currentSettings);
  }, [currentSettings]);

  useEffect(() => {
    setLiveCurrentChatSettings(currentChatSettings);
  }, [currentChatSettings]);

  useEffect(() => {
    if (!canEditCurrentChat && settingsScope === 'currentChat') {
      setSettingsScope('defaults');
    }
  }, [canEditCurrentChat, settingsScope]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setPendingFocusId(null);
    }
  }, [isOpen]);

  const effectiveScope = canEditCurrentChat ? settingsScope : 'defaults';

  const scopedSettings = useMemo(
    () =>
      buildSettingsForModal({
        appSettings: liveSettings,
        activeSessionId: canEditCurrentChat ? 'active' : null,
        currentChatSettings: liveCurrentChatSettings,
        scope: effectiveScope,
      }),
    [canEditCurrentChat, effectiveScope, liveCurrentChatSettings, liveSettings],
  );
  const settingsTransferActions = useSettingsTransferActions();

  const saveScopedSettings = (nextSettings: AppSettings) => {
    const previousSettings = buildSettingsForModal({
      appSettings: liveSettings,
      activeSessionId: canEditCurrentChat ? 'active' : null,
      currentChatSettings: liveCurrentChatSettings,
      scope: effectiveScope,
    });
    const splitUpdate = splitScopedSettingsUpdate({
      scope: effectiveScope,
      previousSettings,
      nextSettings,
      appSettings: liveSettings,
      currentChatSettings: liveCurrentChatSettings,
    });

    if (splitUpdate.nextAppSettings) {
      setLiveSettings(splitUpdate.nextAppSettings);
      onSave(splitUpdate.nextAppSettings);
    }

    if (splitUpdate.nextChatSettings && onSaveCurrentChatSettings) {
      setLiveCurrentChatSettings(splitUpdate.nextChatSettings);
      onSaveCurrentChatSettings(splitUpdate.nextChatSettings);
    }
  };

  const {
    activeTab,
    setActiveTab,
    confirmConfig,
    closeConfirm,
    scrollContainerRef,
    handleContentScroll,
    handleResetToDefaults,
    handleClearLogs,
    handleRequestClearHistory,
    handleRequestClearCache,
    handleRequestImportHistory,
    updateSetting,
    handleModelChange,
    tabs,
  } = useSettingsLogic({
    isOpen,
    currentSettings: scopedSettings,
    onSave: saveScopedSettings,
    onClearAllHistory,
    onClearCache,
    onImportHistory: settingsTransferActions.onImportHistory,
    t,
  });

  const activeTabLabelKey = tabs.find((tab) => tab.id === activeTab)?.labelKey;
  const activeTabUsesScope = !isSearching && chatScopedTabs.has(activeTab);
  const visibleScope = activeTabUsesScope ? settingsScope : 'defaults';
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);

  const searchResults = useMemo(() => searchSettingsCatalog(searchQuery, t), [searchQuery, t]);

  useEffect(() => {
    setSearchSelectedIndex(0);
  }, [searchQuery]);

  const handleTabChange = useCallback(
    (tab: SettingsTab) => {
      setSearchQuery('');
      setActiveTab(tab);
    },
    [setActiveTab],
  );

  const handleSelectSearchResult = useCallback(
    (result: SettingsSearchResult) => {
      setPendingFocusId(result.id);
      setSearchQuery('');
      setActiveTab(result.tab);
    },
    [setActiveTab],
  );

  useEffect(() => {
    if (!isOpen) return;

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      if (isSearching && searchResults.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSearchSelectedIndex((prev) => (prev + 1) % searchResults.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSearchSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
          return;
        }
        if (event.key === 'Enter') {
          const selected = searchResults[searchSelectedIndex];
          if (selected) {
            event.preventDefault();
            handleSelectSearchResult(selected);
            return;
          }
        }
      }

      if (event.key !== '/' || isEditableTarget(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectSearchResult, isOpen, isSearching, searchResults, searchSelectedIndex]);

  useEffect(() => {
    if (!activeTabUsesScope && settingsScope !== 'defaults') {
      setSettingsScope('defaults');
    }
  }, [activeTabUsesScope, settingsScope]);

  useEffect(() => {
    if (!pendingFocusId || isSearching || !isOpen) {
      return;
    }

    let highlightTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        setPendingFocusId(null);
        return;
      }

      const target = container.querySelector(
        `[data-settings-item="${CSS.escape(pendingFocusId)}"]`,
      ) as HTMLElement | null;

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add(...SETTINGS_FOCUS_HIGHLIGHT_CLASSES);
        highlightTimer = window.setTimeout(() => {
          target.classList.remove(...SETTINGS_FOCUS_HIGHLIGHT_CLASSES);
        }, 1600);
      }

      setPendingFocusId(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (highlightTimer !== undefined) {
        window.clearTimeout(highlightTimer);
      }
    };
  }, [pendingFocusId, isSearching, isOpen, activeTab, scrollContainerRef]);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        noPadding
        enterAnimationClassName=""
        ariaLabel={t('settingsTitle')}
        contentClassName="w-full h-[100dvh] sm:h-[85vh] sm:max-h-[800px] sm:w-[90vw] max-w-6xl sm:rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl bg-[var(--theme-bg-primary)] transition-all"
        initialFocusRef={activeTabRef}
      >
        <SettingsSidebar
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onClose={onClose}
          activeTabRef={activeTabRef}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[var(--theme-bg-primary)] relative overflow-hidden">
          <div
            ref={scrollContainerRef}
            onScroll={handleContentScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:pt-4 md:pb-8"
          >
            <div className="max-w-3xl mx-auto w-full pb-4 md:pb-6 md:min-h-[48px] flex flex-col justify-center">
              <div className="flex items-center justify-between gap-3">
                <h2 className="hidden md:block text-xl font-semibold text-[var(--theme-text-primary)] min-w-0 truncate">
                  {isSearching ? t('settingsSearchAria') : activeTabLabelKey ? t(activeTabLabelKey) : ''}
                </h2>
                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                  {activeTabUsesScope && (
                    <div
                      className={SETTINGS_SEGMENTED_TRACK_CLASS}
                      role="group"
                      aria-label={t('settingsScopeDefaults')}
                    >
                      <button
                        type="button"
                        onClick={() => setSettingsScope('defaults')}
                        className={
                          visibleScope === 'defaults' ? SETTINGS_SEGMENTED_ACTIVE_CLASS : SETTINGS_SEGMENTED_IDLE_CLASS
                        }
                      >
                        {t('settingsScopeDefaults')}
                      </button>
                      <button
                        type="button"
                        onClick={() => canEditCurrentChat && setSettingsScope('currentChat')}
                        disabled={!canEditCurrentChat}
                        title={!canEditCurrentChat ? t('settingsScopeCurrentChatUnavailable') : undefined}
                        className={
                          visibleScope === 'currentChat'
                            ? SETTINGS_SEGMENTED_ACTIVE_CLASS
                            : SETTINGS_SEGMENTED_IDLE_CLASS
                        }
                      >
                        {t('settingsScopeCurrentChat')}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${MODAL_CLOSE_BUTTON_CLASS} hidden md:inline-flex`}
                    aria-label={t('close')}
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
            {isSearching ? (
              <div className="max-w-3xl mx-auto w-full">
                <SettingsSearchResults
                  results={searchResults}
                  onSelect={handleSelectSearchResult}
                  selectedIndex={searchSelectedIndex}
                />
              </div>
            ) : (
              <SettingsContent
                activeTab={activeTab}
                currentSettings={scopedSettings}
                currentThemeId={currentThemeId}
                availableModels={availableModels}
                updateSetting={updateSetting}
                handleModelChange={handleModelChange}
                setAvailableModels={setAvailableModels}
                onClearHistory={handleRequestClearHistory}
                onClearCache={handleRequestClearCache}
                onOpenLogViewer={() => {
                  onOpenLogViewer();
                  onClose();
                }}
                onClearLogs={handleClearLogs}
                onReset={handleResetToDefaults}
                onInstallPwa={onInstallPwa}
                installState={installState}
                onImportSettings={settingsTransferActions.onImportSettings}
                onExportSettings={settingsTransferActions.onExportSettings}
                onImportHistory={handleRequestImportHistory}
                onExportHistory={settingsTransferActions.onExportHistory}
                onImportScenarios={onImportScenarios}
                onExportScenarios={onExportScenarios}
              />
            )}
          </div>
        </main>
      </Modal>

      {confirmConfig.isOpen && (
        <ConfirmationModal
          isOpen={confirmConfig.isOpen}
          onClose={closeConfirm}
          onConfirm={confirmConfig.onConfirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          isDanger={confirmConfig.isDanger}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={t('cancel')}
        />
      )}
    </>
  );
};
