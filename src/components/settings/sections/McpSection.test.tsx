import { act, type ComponentProps } from 'react';
import { fireEvent } from '@testing-library/react';
import { DEFAULT_APP_SETTINGS } from '@/constants/appConstants';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/providerTestUtils';
import type { AppSettings } from '@/types';
import { McpSection } from './McpSection';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMcpServerCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/mcpApi', () => ({
  fetchMcpServerCapabilities: fetchMcpServerCapabilitiesMock,
}));

describe('McpSection', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderMcpSection = async (overrides: Partial<ComponentProps<typeof McpSection>> = {}) => {
    await act(async () => {
      renderer.root.render(<McpSection settings={DEFAULT_APP_SETTINGS} onUpdate={vi.fn()} {...overrides} />);
    });
  };

  it('updates only the edited server when multiple MCP servers share the same id', async () => {
    const onUpdate = vi.fn();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      mcpServers: [
        {
          id: 'duplicate',
          name: 'First Server',
          enabled: true,
          transport: 'stdio',
          command: 'npx',
        },
        {
          id: 'duplicate',
          name: 'Second Server',
          enabled: true,
          transport: 'stdio',
          command: 'node',
        },
      ],
    };

    await renderMcpSection({ settings, onUpdate });

    const nameInputs = Array.from(renderer.container.querySelectorAll<HTMLInputElement>('input')).filter(
      (input) => input.value === 'First Server' || input.value === 'Second Server',
    );
    expect(nameInputs).toHaveLength(2);

    await act(async () => {
      fireEvent.change(nameInputs[1], { target: { value: 'Renamed Second Server' } });
    });

    expect(onUpdate).toHaveBeenCalledWith('mcpServers', [
      settings.mcpServers[0],
      {
        ...settings.mcpServers[1],
        name: 'Renamed Second Server',
      },
    ]);
  });

  it('tests a server and shows discovered MCP capabilities', async () => {
    fetchMcpServerCapabilitiesMock.mockResolvedValue({
      tools: [{ name: 'read_file' }],
      resources: [{ uri: 'file:///tmp/readme.md', name: 'README' }],
      resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'File' }],
      prompts: [{ name: 'summarize' }],
    });
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      mcpServers: [
        {
          id: 'remote',
          name: 'Remote',
          enabled: true,
          transport: 'http',
          url: 'https://mcp.example.com/mcp',
        },
      ],
    };

    await renderMcpSection({ settings });

    const testButton = Array.from(renderer.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Test',
    );
    expect(testButton).not.toBeUndefined();

    await act(async () => {
      fireEvent.click(testButton!);
    });

    expect(fetchMcpServerCapabilitiesMock).toHaveBeenCalledWith(settings.mcpServers[0]);
    expect(renderer.container.textContent).toContain('Tools 1');
    expect(renderer.container.textContent).toContain('Resources 2');
    expect(renderer.container.textContent).toContain('Prompts 1');
  });
});
