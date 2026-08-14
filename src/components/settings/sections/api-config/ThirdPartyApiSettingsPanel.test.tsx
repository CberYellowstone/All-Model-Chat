import { act, type ComponentProps } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupStoreStateReset } from '@/test/stores/reset';
import { useSettingsStore } from '@/stores/settingsStore';
import { createDefaultThirdPartyApiSettings } from '@/utils/thirdPartyApiProviders';
import type { AppSettings } from '@/types';
import { ThirdPartyApiSettingsPanel } from './ThirdPartyApiSettingsPanel';

describe('ThirdPartyApiSettingsPanel', () => {
  const renderer = setupTestRenderer();
  setupStoreStateReset();

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createPanelProps = (
    overrides: Partial<ComponentProps<typeof ThirdPartyApiSettingsPanel>> = {},
  ): ComponentProps<typeof ThirdPartyApiSettingsPanel> => {
    const base: AppSettings = useSettingsStore.getState().appSettings;
    return {
      settings: base,
      onUpdateSettings: vi.fn(),
      ...overrides,
    };
  };

  it('does not write settings when expanding and collapsing a provider card', () => {
    const onUpdateSettings = vi.fn();

    act(() => {
      renderer.root.render(<ThirdPartyApiSettingsPanel {...createPanelProps({ onUpdateSettings })} />);
    });

    // With no provider enabled the panel starts fully collapsed; the OpenAI card
    // header row is the first card button.
    const firstCard = Array.from(renderer.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('OpenAI'),
    );
    expect(firstCard).toBeDefined();

    act(() => {
      firstCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onUpdateSettings).not.toHaveBeenCalled();

    // Collapse it again.
    act(() => {
      firstCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onUpdateSettings).not.toHaveBeenCalled();
  });

  it('initially expands the first enabled provider', () => {
    const providers = createDefaultThirdPartyApiSettings().providers;
    const enabledSettings: AppSettings = {
      ...useSettingsStore.getState().appSettings,
      thirdPartyApi: {
        providers: {
          ...providers,
          openai: { ...providers.openai, enabled: true },
        },
      },
    };

    act(() => {
      renderer.root.render(<ThirdPartyApiSettingsPanel {...createPanelProps({ settings: enabledSettings })} />);
    });

    // The OpenAI card is expanded by default (first enabled provider), so its
    // API key textarea is visible.
    const keyInput = renderer.container.querySelector('#api-key-input');
    expect(keyInput).not.toBeNull();
  });
});
