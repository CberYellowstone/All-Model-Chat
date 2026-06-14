import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/formClasses';
import type { AppSettings, ThirdPartyApiSettings, ThirdPartyProviderId } from '@/types';
import {
  THIRD_PARTY_PROVIDER_IDS,
  THIRD_PARTY_PROVIDER_LABELS,
  getThirdPartyProviderConfig,
  updateActiveThirdPartyProviderConfig,
} from '@/utils/thirdPartyApiProviders';
import { ApiKeyInput } from './ApiKeyInput';
import { ApiConnectionTester } from './ApiConnectionTester';
import { OpenAICompatibleModelListEditor } from './OpenAICompatibleModelListEditor';

interface ThirdPartyApiSettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onResetConnectionTest: () => void;
  onTestConnection: () => void;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testMessage: string | null;
  hasEnvKey: boolean;
}

export const ThirdPartyApiSettingsPanel: React.FC<ThirdPartyApiSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onResetConnectionTest,
  onTestConnection,
  testStatus,
  testMessage,
}) => {
  const { t } = useI18n();
  const activeConfig = getThirdPartyProviderConfig(settings);

  const updateThirdPartyApi = (next: ThirdPartyApiSettings) => {
    onUpdateSettings({ thirdPartyApi: next });
  };

  const handleProviderChange = (providerId: ThirdPartyProviderId) => {
    updateThirdPartyApi({ ...settings.thirdPartyApi, activeProvider: providerId });
    onResetConnectionTest();
  };

  const updateActiveField = <K extends keyof typeof activeConfig>(key: K, value: (typeof activeConfig)[K]) => {
    updateThirdPartyApi(updateActiveThirdPartyProviderConfig(settings.thirdPartyApi, { [key]: value }));
    onResetConnectionTest();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="third-party-provider-select"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]"
        >
          {t('thirdPartyApiProviderLabel')}
        </label>
        <select
          id="third-party-provider-select"
          value={settings.thirdPartyApi.activeProvider}
          onChange={(e) => handleProviderChange(e.target.value as ThirdPartyProviderId)}
          className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm ${SETTINGS_INPUT_CLASS}`}
        >
          {THIRD_PARTY_PROVIDER_IDS.map((providerId) => (
            <option key={providerId} value={providerId}>
              {THIRD_PARTY_PROVIDER_LABELS[providerId]}
            </option>
          ))}
        </select>
      </div>

      <ApiKeyInput
        apiKey={activeConfig.apiKey}
        setApiKey={(value) => updateActiveField('apiKey', value)}
        label={t('thirdPartyApiKey')}
        placeholder={t('apiConfigOpenaiKeyPlaceholder')}
        helpText={t('thirdPartyApiKeyHelp')}
      />

      <div className="space-y-2">
        <label
          htmlFor="third-party-base-url-input"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]"
        >
          {t('thirdPartyApiBaseUrl')}
        </label>
        <input
          id="third-party-base-url-input"
          type="text"
          value={activeConfig.baseUrl || ''}
          onChange={(e) => updateActiveField('baseUrl', e.target.value)}
          className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm custom-scrollbar font-mono ${SETTINGS_INPUT_CLASS}`}
          aria-label={t('thirdPartyApiBaseUrl')}
        />
      </div>

      <OpenAICompatibleModelListEditor
        models={activeConfig.models}
        selectedModelId={activeConfig.modelId}
        onModelsChange={(models) => updateActiveField('models', models)}
        onSelectedModelChange={(modelId) => updateActiveField('modelId', modelId)}
      />

      <ApiConnectionTester
        onTest={onTestConnection}
        testStatus={testStatus}
        testMessage={testMessage}
        isTestDisabled={testStatus === 'testing' || !activeConfig.apiKey}
      />
    </div>
  );
};
