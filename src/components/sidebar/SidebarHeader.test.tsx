import { act } from 'react';
import { setupTestRenderer } from '@/test/render/renderer';
import { describe, expect, it, vi } from 'vitest';
import { SidebarHeader } from './SidebarHeader';

describe('SidebarHeader', () => {
  const renderer = setupTestRenderer();

  const getLogoLink = () =>
    Array.from(renderer.container.querySelectorAll<HTMLAnchorElement>('a')).find((link) =>
      link.querySelector('img[alt="AMC WebUI"]'),
    );

  const renderHeader = (
    props: Partial<{
      isOpen: boolean;
      onToggle: () => void;
      themeId: string;
    }> = {},
  ) => {
    const onToggle = props.onToggle ?? vi.fn();
    act(() => {
      renderer.root.render(
        <SidebarHeader
          isOpen={props.isOpen ?? true}
          onToggle={onToggle}
          themeId={props.themeId ?? 'pearl'}
        />,
      );
    });
    return { onToggle };
  };

  it('renders the sidebar logo from the PNG asset', () => {
    renderHeader({ themeId: 'pearl' });

    const logoLink = getLogoLink();
    const logo = logoLink?.querySelector('img[alt="AMC WebUI"]');

    expect(logo?.getAttribute('src')).toBe('/app-logo.png');
    expect(logoLink?.querySelector('svg')).toBeNull();
  });

  it('uses the dark sidebar logo for the onyx theme', () => {
    renderHeader({ themeId: 'onyx' });

    const logo = getLogoLink()?.querySelector('img[alt="AMC WebUI"]');

    expect(logo?.getAttribute('src')).toBe('/app-logo-dark.png');
  });

  it('uses the dark sidebar logo for the graphite theme', () => {
    renderHeader({ themeId: 'graphite' });

    const logo = getLogoLink()?.querySelector('img[alt="AMC WebUI"]');

    expect(logo?.getAttribute('src')).toBe('/app-logo-dark.png');
  });

  it('opens a new chat in a new browser tab when the logo is used', () => {
    renderHeader();

    const logoLink = getLogoLink();

    expect(logoLink).not.toBeNull();
    expect(logoLink?.getAttribute('href')).toBe('/');
    expect(logoLink?.getAttribute('target')).toBe('_blank');
    expect(logoLink?.getAttribute('rel')).toContain('noopener');
    expect(logoLink?.getAttribute('aria-label')).toBe('Start a new chat session');
  });

  it('raises the expanded sidebar toggle in the header chrome', () => {
    renderHeader();

    const toggle = renderer.container.querySelector('button[aria-label="Close history sidebar"]');

    expect(toggle?.className).toContain('-translate-y-1');
  });
});
