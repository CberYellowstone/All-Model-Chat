import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { KeyRound, LayoutPanelLeft, Network, SlidersHorizontal, X } from 'lucide-react';
import { type SettingsTab, type SettingsTabDescriptor } from '@/stores/settingsUiStore';
import { IconAbout, IconData, IconKeyboard } from '@/components/icons';
import { SETTINGS_NAV_ACTIVE_CLASS, SETTINGS_NAV_IDLE_CLASS } from '@/constants/designTokens';

const SETTINGS_TAB_ICONS: Record<SettingsTab, React.ElementType> = {
  models: SlidersHorizontal,
  interface: LayoutPanelLeft,
  api: KeyRound,
  mcp: Network,
  data: IconData,
  shortcuts: IconKeyboard,
  about: IconAbout,
};

interface SettingsSidebarProps {
  tabs: SettingsTabDescriptor[];
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  onClose: () => void;
  activeTabRef?: React.Ref<HTMLButtonElement>;
}

const SIDEBAR_GROUPS: Array<{ id: string; tabIds: SettingsTab[] }> = [
  {
    id: 'primary',
    tabIds: ['models', 'api', 'mcp', 'interface', 'data'],
  },
  {
    id: 'shortcuts',
    tabIds: ['shortcuts'],
  },
  {
    id: 'about',
    tabIds: ['about'],
  },
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  onClose,
  activeTabRef,
}) => {
  const { t } = useI18n();
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const groupedTabs = SIDEBAR_GROUPS.map((group) => ({
    id: group.id,
    tabs: group.tabIds.map((tabId) => tabsById.get(tabId)).filter((tab): tab is SettingsTabDescriptor => !!tab),
  })).filter((group) => group.tabs.length > 0);

  const renderTabButton = (tab: SettingsTabDescriptor) => {
    const Icon = SETTINGS_TAB_ICONS[tab.id];
    const isActive = activeTab === tab.id;

    return (
      <button
        key={tab.id}
        ref={isActive ? activeTabRef : undefined}
        onClick={() => setActiveTab(tab.id)}
        className={`flex-shrink-0 flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 text-sm rounded-lg transition-colors outline-none select-none w-auto md:w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)] ${
          isActive ? SETTINGS_NAV_ACTIVE_CLASS : SETTINGS_NAV_IDLE_CLASS
        }`}
        role="tab"
        aria-selected={isActive}
      >
        <Icon
          size={18}
          strokeWidth={isActive ? 2 : 1.5}
          className={isActive ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-tertiary)]'}
        />
        <span>{t(tab.labelKey)}</span>
      </button>
    );
  };

  return (
    <aside className="flex-shrink-0 w-full md:w-64 bg-[var(--theme-bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--theme-border-primary)] flex flex-col">
      {/* Mobile header with close; desktop close lives in the content pane. */}
      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-5 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-md hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)] md:hidden"
          aria-label={t('close')}
        >
          <X size={20} strokeWidth={2} />
        </button>
        <span className="md:hidden font-semibold text-[var(--theme-text-primary)]">{t('settingsTitle')}</span>
        <div className="w-8 md:hidden" aria-hidden="true" />
        <span className="hidden md:block text-sm font-semibold text-[var(--theme-text-primary)]">
          {t('settingsTitle')}
        </span>
      </div>

      <nav
        className="flex-1 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden custom-scrollbar px-2 pb-2 md:px-3 md:pb-3 flex md:flex-col gap-1 md:gap-1.5"
        role="tablist"
      >
        {groupedTabs.map((group, groupIndex) => (
          <div
            key={group.id}
            data-settings-group={group.id}
            className={`flex flex-shrink-0 md:w-full md:flex-col gap-1 md:gap-1.5 ${
              groupIndex > 0 ? 'md:mt-3 md:border-t md:border-[var(--theme-border-primary)] md:pt-3' : ''
            }`}
          >
            {group.tabs.map(renderTabButton)}
          </div>
        ))}
      </nav>
    </aside>
  );
};
