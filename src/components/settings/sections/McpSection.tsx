import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AppSettings, McpServerConfig, McpServerTransport } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/styleClasses';

interface McpSectionProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const inputBaseClasses =
  'w-full rounded-lg border p-2.5 text-sm transition-all duration-200 focus:ring-2 focus:ring-offset-0';
const labelClasses = 'text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]';
const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-[var(--theme-border-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text-secondary)] transition-colors hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]';

const createMcpServer = (): McpServerConfig => ({
  id: `mcp-${Date.now()}`,
  name: 'New MCP Server',
  enabled: false,
  transport: 'stdio',
  command: '',
  args: [],
  env: {},
});

const formatLines = (items: string[] | undefined): string => (items ?? []).join('\n');

const parseLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const formatRecord = (record: Record<string, string> | undefined): string =>
  Object.entries(record ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

const parseRecord = (value: string): Record<string, string> => {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line): Array<[string, string]> => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return [];
      }

      const key = line.slice(0, separatorIndex).trim();
      const recordValue = line.slice(separatorIndex + 1).trim();
      return key ? [[key, recordValue]] : [];
    });

  return Object.fromEntries(entries);
};

export const McpSection: React.FC<McpSectionProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const servers = settings.mcpServers ?? [];

  const updateServers = (nextServers: McpServerConfig[]) => {
    onUpdate('mcpServers', nextServers);
  };

  const updateServer = (serverIndex: number, updates: Partial<McpServerConfig>) => {
    updateServers(servers.map((server, index) => (index === serverIndex ? { ...server, ...updates } : server)));
  };

  const removeServer = (serverIndex: number) => {
    updateServers(servers.filter((_, index) => index !== serverIndex));
  };

  const addServer = () => {
    updateServers([...servers, createMcpServer()]);
  };

  const handleTransportChange = (serverIndex: number, server: McpServerConfig, transport: McpServerTransport) => {
    if (transport === 'stdio') {
      updateServer(serverIndex, {
        transport,
        command: server.command ?? '',
        args: server.args ?? [],
        env: server.env ?? {},
      });
      return;
    }

    updateServer(serverIndex, {
      transport,
      url: server.url ?? '',
      headers: server.headers ?? {},
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--theme-text-primary)]">{t('settingsMcpTitle')}</h3>
          <p className="text-sm leading-relaxed text-[var(--theme-text-tertiary)]">{t('settingsMcpDescription')}</p>
        </div>
        <button type="button" onClick={addServer} className={secondaryButtonClass}>
          <Plus size={14} strokeWidth={1.7} />
          {t('settingsMcpAddServer')}
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--theme-border-secondary)] p-5 text-sm text-[var(--theme-text-tertiary)]">
          {t('settingsMcpEmpty')}
        </div>
      ) : (
        <div className="space-y-5">
          {servers.map((server, index) => (
            <section
              key={`${server.id || 'mcp-server'}-${index}`}
              className="rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    id={`mcp-enabled-${server.id}`}
                    type="checkbox"
                    checked={server.enabled}
                    onChange={(event) => updateServer(index, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-[var(--theme-border-secondary)] text-[var(--theme-text-link)] focus:ring-[var(--theme-border-focus)]"
                  />
                  <label
                    htmlFor={`mcp-enabled-${server.id}`}
                    className="text-sm font-medium text-[var(--theme-text-primary)]"
                  >
                    {server.name || t('settingsMcpUnnamedServer').replace('{index}', String(index + 1))}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeServer(index)}
                  className="rounded-md p-1.5 text-[var(--theme-text-tertiary)] transition-colors hover:bg-[var(--theme-bg-danger)]/10 hover:text-[var(--theme-text-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]"
                  aria-label={t('settingsMcpRemoveServer')}
                >
                  <Trash2 size={15} strokeWidth={1.7} />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClasses}>{t('settingsMcpServerName')}</span>
                  <input
                    value={server.name}
                    onChange={(event) => updateServer(index, { name: event.target.value })}
                    className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS}`}
                  />
                </label>

                <label className="space-y-2">
                  <span className={labelClasses}>{t('settingsMcpServerId')}</span>
                  <input
                    value={server.id}
                    onChange={(event) => updateServer(index, { id: event.target.value.trim() })}
                    className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                  />
                </label>

                <label className="space-y-2">
                  <span className={labelClasses}>{t('settingsMcpTransport')}</span>
                  <select
                    value={server.transport}
                    onChange={(event) => handleTransportChange(index, server, event.target.value as McpServerTransport)}
                    className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS}`}
                  >
                    <option value="stdio">{t('settingsMcpTransportStdio')}</option>
                    <option value="http">{t('settingsMcpTransportHttp')}</option>
                  </select>
                </label>

                {server.transport === 'stdio' ? (
                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpCommand')}</span>
                    <input
                      value={server.command ?? ''}
                      onChange={(event) => updateServer(index, { command: event.target.value })}
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                      placeholder="npx"
                    />
                  </label>
                ) : (
                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpUrl')}</span>
                    <input
                      value={server.url ?? ''}
                      onChange={(event) => updateServer(index, { url: event.target.value })}
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                      placeholder="https://example.com/mcp"
                    />
                  </label>
                )}
              </div>

              {server.transport === 'stdio' ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpArgs')}</span>
                    <textarea
                      value={formatLines(server.args)}
                      onChange={(event) => updateServer(index, { args: parseLines(event.target.value) })}
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} min-h-[96px] resize-y font-mono`}
                      placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/Users/me"
                      spellCheck={false}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpEnv')}</span>
                    <textarea
                      value={formatRecord(server.env)}
                      onChange={(event) => updateServer(index, { env: parseRecord(event.target.value) })}
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} min-h-[96px] resize-y font-mono`}
                      placeholder="TOKEN=value"
                      spellCheck={false}
                    />
                  </label>
                </div>
              ) : (
                <label className="mt-4 block space-y-2">
                  <span className={labelClasses}>{t('settingsMcpHeaders')}</span>
                  <textarea
                    value={formatRecord(server.headers)}
                    onChange={(event) => updateServer(index, { headers: parseRecord(event.target.value) })}
                    className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} min-h-[96px] resize-y font-mono`}
                    placeholder="Authorization=Bearer token"
                    spellCheck={false}
                  />
                </label>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
