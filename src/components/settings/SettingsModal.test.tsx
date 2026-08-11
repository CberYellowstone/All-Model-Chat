import { act, type ComponentProps } from 'react';
import { fireEvent } from '@testing-library/react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS, DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import { ensureFeatureTranslations } from '@/i18n/featureTranslations';
import { setupStoreStateReset } from '@/test/stores/reset';
import { SettingsModal } from './SettingsModal';

describe('SettingsModal', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });
  setupStoreStateReset();

  const createSettingsModalProps = (
    overrides: Partial<ComponentProps<typeof SettingsModal>> = {},
  ): ComponentProps<typeof SettingsModal> => ({
    isOpen: true,
    onClose: vi.fn(),
    currentSettings: DEFAULT_APP_SETTINGS,
    currentThemeId: 'pearl',
    availableModels: [],
    onSave: vi.fn(),
    onClearAllHistory: vi.fn(),
    onClearCache: vi.fn(),
    onOpenLogViewer: vi.fn(),
    setAvailableModels: vi.fn(),
    onInstallPwa: vi.fn(),
    installState: 'installed',
    onImportSettings: vi.fn(),
    onExportSettings: vi.fn(),
    onImportHistory: vi.fn(),
    onExportHistory: vi.fn(),
    onImportScenarios: vi.fn(),
    onExportScenarios: vi.fn(),
    ...overrides,
  });

  const renderSettingsModal = async (overrides: Partial<ComponentProps<typeof SettingsModal>> = {}) => {
    await act(async () => {
      renderer.root.render(<SettingsModal {...createSettingsModalProps(overrides)} />);
    });
  };

  beforeEach(() => {
    localStorage.setItem('chatSettingsLastTab', 'api');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the active desktop section title inside the scrollable content area', async () => {
    await renderSettingsModal();

    const fixedDesktopTitle = document.querySelector('main > header h2');
    const scrollingDesktopTitle = document.querySelector('main > div h2');

    expect(fixedDesktopTitle).toBeNull();
    expect(scrollingDesktopTitle?.textContent).toBe('API');
    expect(document.body.textContent).toContain('Test Connection');
  });

  it('opens the settings surface without any enter animation class', async () => {
    await renderSettingsModal();

    const settingsSurface = document.querySelector('[role="dialog"]');

    expect(settingsSurface).not.toBeNull();
    expect(settingsSurface?.className).not.toContain('modal-enter-animation');
    expect(settingsSurface?.className).not.toContain('settings-surface-enter-animation');
  });

  it('shows the granular settings navigation for each settings section', async () => {
    await renderSettingsModal();

    const tabLabels = Array.from(document.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim());

    expect(tabLabels).toEqual(['Models', 'API', 'MCP', 'Interface & Interaction', 'Data & App', 'Shortcuts', 'About']);
    expect(document.body.textContent).not.toContain('Chat');
  });

  it('renders shortcuts in its own sidebar group', async () => {
    await renderSettingsModal();

    const groupTabLabels = Array.from(document.querySelectorAll('[data-settings-group]')).map((group) =>
      Array.from(group.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim()),
    );

    expect(groupTabLabels).toEqual([
      ['Models', 'API', 'MCP', 'Interface & Interaction', 'Data & App'],
      ['Shortcuts'],
      ['About'],
    ]);

    const groupElements = document.querySelectorAll('[data-settings-group]');
    for (const group of groupElements) {
      expect(group.className).not.toContain('border-t');
    }
  });

  it('places the desktop close control in the content pane, not the sidebar', async () => {
    await renderSettingsModal();

    const closeButtons = Array.from(document.querySelectorAll('button[aria-label="Close"]'));
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);

    const contentClose = document.querySelector('main button[aria-label="Close"]');
    expect(contentClose).not.toBeNull();
    expect(contentClose?.className).toContain('md:inline-flex');
  });

  it('routes scoped chat changes to current chat settings', async () => {
    const onSave = vi.fn();
    const onSaveCurrentChatSettings = vi.fn();

    localStorage.setItem('chatSettingsLastTab', 'models');
    await renderSettingsModal({
      currentSettings: {
        ...DEFAULT_APP_SETTINGS,
        modelId: 'default-model',
      },
      currentChatSettings: {
        ...DEFAULT_CHAT_SETTINGS,
        modelId: 'current-model',
      },
      hasActiveSession: true,
      availableModels: [
        { id: 'current-model', name: 'Current Model' },
        { id: 'next-chat-model', name: 'Next Chat Model' },
      ],
      onSave,
      onSaveCurrentChatSettings,
    });

    await act(async () => {
      Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent === 'Current Chat')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      document
        .querySelector('[data-testid="settings-model-option-gemini-native:next-chat-model"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSaveCurrentChatSettings).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'next-chat-model' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the scope toggle only on chat-scoped settings tabs', async () => {
    localStorage.setItem('chatSettingsLastTab', 'models');
    await renderSettingsModal({
      currentChatSettings: DEFAULT_CHAT_SETTINGS,
      hasActiveSession: true,
      onSaveCurrentChatSettings: vi.fn(),
    });

    expect(document.body.textContent).toContain('Current Chat');

    await act(async () => {
      Array.from(document.querySelectorAll('[role="tab"]'))
        .find((tab) => tab.textContent?.includes('Interface & Interaction'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).not.toContain('Current Chat');
  });

  it('searches settings and navigates to the matching section', async () => {
    await ensureFeatureTranslations('settings');
    localStorage.setItem('chatSettingsLastTab', 'api');
    await renderSettingsModal();

    const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Search settings"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      fireEvent.change(searchInput!, { target: { value: 'mermaid' } });
    });

    expect(searchInput?.value).toBe('mermaid');
    expect(document.body.textContent).toContain('Render Mermaid Diagrams');
    expect(document.body.textContent).toMatch(/result/i);

    const mermaidResult = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Render Mermaid Diagrams'),
    );
    expect(mermaidResult).toBeDefined();

    await act(async () => {
      fireEvent.click(mermaidResult!);
    });

    const clearedSearch = document.querySelector<HTMLInputElement>('input[aria-label="Search settings"]');
    expect(clearedSearch?.value).toBe('');
    expect(document.body.textContent).toContain('Rendering & Preview');
    expect(document.body.textContent).toContain('Render Mermaid Diagrams');
    expect(document.querySelector('[data-settings-item="interface-mermaid"]')).not.toBeNull();
  });
});
