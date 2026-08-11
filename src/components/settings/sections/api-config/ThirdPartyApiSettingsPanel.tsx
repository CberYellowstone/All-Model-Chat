import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/formClasses';
import { Toggle } from '@/components/shared/Toggle';
import { getOpenAICompatibleBaseUrlWarning } from '@/services/api/openaiCompatibleUrls';
import { getErrorMessage } from '@/utils/errorMessage';
import type { AppSettings, ThirdPartyApiSettings, ThirdPartyProviderId } from '@/types';
import {
  THIRD_PARTY_PROVIDER_IDS,
  THIRD_PARTY_PROVIDER_LABELS,
  createDefaultThirdPartyApiSettings,
  getEnabledThirdPartyProviders,
  updateThirdPartyProviderConfig,
} from '@/utils/thirdPartyApiProviders';
import { THIRD_PARTY_PROVIDER_LOGO } from '@/components/shared/ModelIcon';
import { sendAnthropicMessageNonStream } from '@/services/api/anthropicApi';
import { sendOpenAICompatibleMessageNonStream } from '@/services/api/openaiCompatibleApi';
import { parseApiKeys } from '@/utils/apiKeySelection';
import { ApiKeyInput } from './ApiKeyInput';
import { ApiConnectionTester } from './ApiConnectionTester';
import { OpenAICompatibleModelListEditor } from './OpenAICompatibleModelListEditor';

interface ThirdPartyApiSettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
}

export const ThirdPartyApiSettingsPanel: React.FC<ThirdPartyApiSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const { t } = useI18n();
  // Expanded-card memory is local component state only — it must never be
  // written into persisted settings (which would leak UI state into the domain
  // model and trigger a settings write + cross-tab broadcast on every expand).
  const [expandedProvider, setExpandedProvider] = useState<ThirdPartyProviderId | null>(
    () => getEnabledThirdPartyProviders(settings)[0]?.id ?? null,
  );
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const thirdPartyApi = settings.thirdPartyApi;
  const expandedConfig = expandedProvider ? thirdPartyApi?.providers?.[expandedProvider] : undefined;

  const updateThirdPartyApi = (next: ThirdPartyApiSettings) => {
    onUpdateSettings({ thirdPartyApi: next });
  };

  const handleToggleEnabled = (providerId: ThirdPartyProviderId) => {
    const provider = thirdPartyApi?.providers?.[providerId];
    const nextEnabled = !provider?.enabled;
    updateThirdPartyApi(
      updateThirdPartyProviderConfig(thirdPartyApi ?? createDefaultThirdPartyApiSettings(), providerId, {
        enabled: nextEnabled,
      }),
    );
  };

  const updateField = <K extends keyof NonNullable<typeof expandedConfig>>(
    key: K,
    value: NonNullable<typeof expandedConfig>[K],
  ) => {
    if (!expandedProvider) return;
    updateThirdPartyApi(
      updateThirdPartyProviderConfig(thirdPartyApi ?? createDefaultThirdPartyApiSettings(), expandedProvider, {
        [key]: value,
      }),
    );
    setTestStatus('idle');
    setTestMessage(null);
  };

  // Connection test targets the currently-expanded provider card — its own key,
  // baseUrl and modelId — so the button's semantics never drift with a global
  // mode. Nothing is expanded when no provider is enabled, so there is nothing
  // to test.
  const handleTestConnection = async () => {
    if (!expandedProvider || !expandedConfig) {
      setTestStatus('error');
      setTestMessage(t('apiConfigNoKeyAvailable'));
      return;
    }
    const keyToTest = expandedConfig.apiKey;
    if (!keyToTest) {
      setTestStatus('error');
      setTestMessage(t('apiConfigNoKeyAvailable'));
      return;
    }

    const keys = parseApiKeys(keyToTest);
    const firstKey = keys[0];

    if (!firstKey) {
      setTestStatus('error');
      setTestMessage(t('apiConfigInvalidKeyFormat'));
      return;
    }

    setTestStatus('testing');
    setTestMessage(null);

    try {
      const providerConfig = {
        baseUrl: expandedConfig.baseUrl,
        temperature: 0,
      };
      let providerError: Error | null = null;
      const onError = (error: Error) => {
        providerError = error;
      };

      if (expandedConfig.protocol === 'anthropic') {
        await sendAnthropicMessageNonStream(
          firstKey,
          expandedConfig.modelId,
          [],
          [{ text: 'Hello' }],
          providerConfig,
          new AbortController().signal,
          onError,
          () => undefined,
        );
      } else {
        await sendOpenAICompatibleMessageNonStream(
          firstKey,
          expandedConfig.modelId,
          [],
          [{ text: 'Hello' }],
          providerConfig,
          new AbortController().signal,
          onError,
          () => undefined,
        );
      }

      if (providerError) {
        throw providerError;
      }

      setTestStatus('success');
    } catch (error) {
      setTestStatus('error');
      setTestMessage(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {THIRD_PARTY_PROVIDER_IDS.map((providerId) => {
          const config = thirdPartyApi?.providers?.[providerId];
          const isEnabled = config?.enabled === true;
          const hasKey = !!config?.apiKey;
          const isExpanded = expandedProvider === providerId;

          return (
            <div
              key={providerId}
              className={`rounded-lg border transition-all ${
                isEnabled
                  ? 'border-[var(--theme-border-focus)] bg-[var(--theme-bg-tertiary)]/30'
                  : 'border-[var(--theme-border-secondary)]/40 bg-[var(--theme-bg-tertiary)]/10'
              }`}
            >
              <div className="flex items-center gap-2 p-2.5">
                <div className="flex-shrink-0">
                  <Toggle
                    checked={isEnabled}
                    onChange={() => handleToggleEnabled(providerId)}
                    ariaLabel={`${THIRD_PARTY_PROVIDER_LABELS[providerId]} ${t('enable')}`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedProvider(isExpanded ? null : providerId)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-[var(--theme-text-tertiary)]" strokeWidth={2} />
                  ) : (
                    <ChevronRight size={14} className="text-[var(--theme-text-tertiary)]" strokeWidth={2} />
                  )}
                  <img
                    src={THIRD_PARTY_PROVIDER_LOGO[providerId]}
                    alt={THIRD_PARTY_PROVIDER_LABELS[providerId]}
                    width={18}
                    height={18}
                    draggable={false}
                    className="flex-shrink-0 object-contain"
                    style={{ width: 18, height: 18 }}
                  />
                  <span className="text-sm font-medium text-[var(--theme-text-primary)] truncate">
                    {THIRD_PARTY_PROVIDER_LABELS[providerId]}
                  </span>
                  {isEnabled && !hasKey && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-bg-warning)] text-[var(--theme-text-warning)]">
                      {t('thirdPartyApiKeyMissing')}
                    </span>
                  )}
                  {isEnabled && hasKey && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--theme-bg-success)] text-[var(--theme-text-success)]">
                      {t('thirdPartyApiReady')}
                    </span>
                  )}
                </button>
              </div>

              {isExpanded && expandedConfig && (
                <div className="px-2.5 pb-2.5 space-y-3 border-t border-[var(--theme-border-secondary)]/30 pt-3">
                  <ApiKeyInput
                    apiKey={expandedConfig.apiKey}
                    setApiKey={(value) => updateField('apiKey', value)}
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
                      value={expandedConfig.baseUrl || ''}
                      onChange={(e) => updateField('baseUrl', e.target.value)}
                      className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm custom-scrollbar font-mono ${SETTINGS_INPUT_CLASS}`}
                      aria-label={t('thirdPartyApiBaseUrl')}
                    />
                    {expandedConfig.protocol === 'openai-compatible' &&
                      (() => {
                        const warning = getOpenAICompatibleBaseUrlWarning(expandedConfig.baseUrl);
                        if (warning === 'chat-completions-endpoint') {
                          return (
                            <p className="text-xs text-[var(--theme-text-warning)]">
                              {t('thirdPartyApiBaseUrlChatCompletionsWarning')}
                            </p>
                          );
                        }
                        if (warning === 'models-endpoint') {
                          return (
                            <p className="text-xs text-[var(--theme-text-warning)]">
                              {t('thirdPartyApiBaseUrlModelsWarning')}
                            </p>
                          );
                        }
                        return null;
                      })()}
                  </div>

                  <OpenAICompatibleModelListEditor
                    models={expandedConfig.models}
                    selectedModelId={expandedConfig.modelId}
                    onModelsChange={(models) => updateField('models', models)}
                    onSelectedModelChange={(modelId) => updateField('modelId', modelId)}
                  />

                  <ApiConnectionTester
                    onTest={handleTestConnection}
                    testStatus={testStatus}
                    testMessage={testMessage}
                    isTestDisabled={testStatus === 'testing' || !expandedConfig.apiKey}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
