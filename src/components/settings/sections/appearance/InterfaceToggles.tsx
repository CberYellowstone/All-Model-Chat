import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { ToggleItem } from '@/components/shared/ToggleItem';
import { type AppSettings } from '@/types';
import { SETTINGS_SECTION_CARD_CLASS, SETTINGS_SECTION_LABEL_CLASS } from '@/constants/designTokens';

interface InterfaceTogglesProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const ToggleGroup: React.FC<{
  title: string;
  children: React.ReactNode;
  groupId?: string;
}> = ({ title, children, groupId }) => (
  <div className={SETTINGS_SECTION_CARD_CLASS} data-settings-item={groupId}>
    <label className={`block ${SETTINGS_SECTION_LABEL_CLASS} mb-2`}>{title}</label>
    <div className="divide-y divide-[var(--theme-border-secondary)]/40">{children}</div>
  </div>
);

const SearchableToggle: React.FC<{
  itemId: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
}> = ({ itemId, label, checked, onChange, tooltip }) => (
  <div data-settings-item={itemId}>
    <ToggleItem label={label} checked={checked} onChange={onChange} tooltip={tooltip} />
  </div>
);

export const InterfaceToggles: React.FC<InterfaceTogglesProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!('Notification' in window)) {
        alert(t('settingsNotificationsUnsupported'));
        return;
      }

      if (Notification.permission === 'denied') {
        alert(t('settingsNotificationsBlocked'));
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }
      }
    }
    onUpdate('isCompletionNotificationEnabled', enabled);
  };

  return (
    <div className="space-y-4">
      <ToggleGroup title={t('settingsInputToolbar')} groupId="interface-input-toolbar">
        <SearchableToggle
          itemId="interface-show-translate"
          label={t('settingsShowInputTranslationButtonLabel')}
          checked={settings.showInputTranslationButton ?? false}
          onChange={(enabled) => onUpdate('showInputTranslationButton', enabled)}
          tooltip={t('settingsShowInputTranslationButtonTooltip')}
        />
        <SearchableToggle
          itemId="interface-show-paste"
          label={t('settingsShowInputPasteButtonLabel')}
          checked={settings.showInputPasteButton ?? true}
          onChange={(enabled) => onUpdate('showInputPasteButton', enabled)}
          tooltip={t('settingsShowInputPasteButtonTooltip')}
        />
        <SearchableToggle
          itemId="interface-show-clear"
          label={t('settingsShowInputClearButtonLabel')}
          checked={settings.showInputClearButton ?? true}
          onChange={(enabled) => onUpdate('showInputClearButton', enabled)}
          tooltip={t('settingsShowInputClearButtonTooltip')}
        />
      </ToggleGroup>

      <ToggleGroup title={t('settingsChatBehavior')} groupId="interface-chat-behavior">
        <SearchableToggle
          itemId="interface-streaming"
          label={t('headerStream')}
          checked={settings.isStreamingEnabled}
          onChange={(enabled) => onUpdate('isStreamingEnabled', enabled)}
        />
        <SearchableToggle
          itemId="interface-auto-title"
          label={t('isAutoTitleEnabled')}
          checked={settings.isAutoTitleEnabled}
          onChange={(enabled) => onUpdate('isAutoTitleEnabled', enabled)}
        />
        <SearchableToggle
          itemId="interface-suggestions"
          label={t('settingsEnableSuggestionsLabel')}
          checked={settings.isSuggestionsEnabled}
          onChange={(enabled) => onUpdate('isSuggestionsEnabled', enabled)}
          tooltip={t('settingsEnableSuggestionsTooltip')}
        />
        <SearchableToggle
          itemId="interface-auto-scroll"
          label={t('settingsAutoScrollOnSendLabel')}
          checked={settings.isAutoScrollOnSendEnabled ?? true}
          onChange={(enabled) => onUpdate('isAutoScrollOnSendEnabled', enabled)}
        />
      </ToggleGroup>

      <ToggleGroup title={t('settingsClipboardInput')} groupId="interface-clipboard">
        <SearchableToggle
          itemId="interface-paste-markdown"
          label={t('settingsPasteRichTextAsMarkdownLabel')}
          checked={settings.isPasteRichTextAsMarkdownEnabled ?? true}
          onChange={(enabled) => onUpdate('isPasteRichTextAsMarkdownEnabled', enabled)}
          tooltip={t('settingsPasteRichTextAsMarkdownTooltip')}
        />
        <SearchableToggle
          itemId="interface-paste-file"
          label={t('settingsPasteAsTextFileLabel')}
          checked={settings.isPasteAsTextFileEnabled ?? true}
          onChange={(enabled) => onUpdate('isPasteAsTextFileEnabled', enabled)}
          tooltip={t('settingsPasteAsTextFileTooltip')}
        />
        <SearchableToggle
          itemId="interface-copy-format"
          label={t('settingsCopySelectionFormattingLabel')}
          checked={settings.isCopySelectionFormattingEnabled ?? true}
          onChange={(enabled) => onUpdate('isCopySelectionFormattingEnabled', enabled)}
          tooltip={t('settingsCopySelectionFormattingTooltip')}
        />
      </ToggleGroup>

      <ToggleGroup title={t('settingsRenderingPreview')} groupId="interface-rendering">
        <SearchableToggle
          itemId="interface-expand-code"
          label={t('settingsExpandCodeBlocksByDefaultLabel')}
          checked={settings.expandCodeBlocksByDefault}
          onChange={(enabled) => onUpdate('expandCodeBlocksByDefault', enabled)}
        />
        <SearchableToggle
          itemId="interface-auto-preview"
          label={t('settingsAutoFullscreenHtmlLabel')}
          checked={settings.autoFullscreenHtml ?? true}
          onChange={(enabled) => onUpdate('autoFullscreenHtml', enabled)}
          tooltip={t('settingsAutoFullscreenHtmlTooltip')}
        />
        <SearchableToggle
          itemId="interface-mermaid"
          label={t('settingsEnableMermaidRenderingLabel')}
          checked={settings.isMermaidRenderingEnabled}
          onChange={(enabled) => onUpdate('isMermaidRenderingEnabled', enabled)}
          tooltip={t('settingsEnableMermaidRenderingTooltip')}
        />
        <SearchableToggle
          itemId="interface-graphviz"
          label={t('settingsEnableGraphvizRenderingLabel')}
          checked={settings.isGraphvizRenderingEnabled ?? true}
          onChange={(enabled) => onUpdate('isGraphvizRenderingEnabled', enabled)}
          tooltip={t('settingsEnableGraphvizRenderingTooltip')}
        />
      </ToggleGroup>

      <ToggleGroup title={t('settingsNotificationsFeedback')} groupId="interface-notifications">
        <SearchableToggle
          itemId="interface-completion-notification"
          label={t('settingsEnableCompletionNotificationLabel')}
          checked={settings.isCompletionNotificationEnabled}
          onChange={handleNotificationToggle}
          tooltip={t('settingsEnableCompletionNotificationTooltip')}
        />
        <SearchableToggle
          itemId="interface-completion-sound"
          label={t('settingsEnableCompletionSoundLabel')}
          checked={settings.isCompletionSoundEnabled ?? false}
          onChange={(enabled) => onUpdate('isCompletionSoundEnabled', enabled)}
          tooltip={t('settingsEnableCompletionSoundTooltip')}
        />
        <SearchableToggle
          itemId="interface-audio-compression"
          label={t('settingsAudioCompressionLabel')}
          checked={settings.isAudioCompressionEnabled}
          onChange={(enabled) => onUpdate('isAudioCompressionEnabled', enabled)}
          tooltip={t('settingsAudioCompressionTooltip')}
        />
      </ToggleGroup>
    </div>
  );
};
