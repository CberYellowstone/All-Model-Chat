import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@/test/render/renderer';
import type { GenerationLease } from '@/features/message-sender/generationLease';

// Fixed tab id so isLocalGeneration's ownership check is deterministic.
vi.mock('@/stores/tabIdentity', () => ({
  TAB_ID: 'test-tab',
}));

const { mockReadGenerationLease, mockIsGenerationLeaseFresh } = vi.hoisted(() => ({
  mockReadGenerationLease: vi.fn<(sessionId: string) => GenerationLease | null>(() => null),
  mockIsGenerationLeaseFresh: vi.fn<(lease: GenerationLease) => boolean>(() => true),
}));

vi.mock('@/features/message-sender/generationLease', () => ({
  readGenerationLease: mockReadGenerationLease,
  isGenerationLeaseFresh: mockIsGenerationLeaseFresh,
}));

import { getFaviconVisualState, useAppFavicon, isLocalGeneration } from './useAppFavicon';

const DEFAULT_HREF = 'http://localhost/favicon.png';
const GENERATING_HREF = 'http://localhost/favicon-generating.png';
const SUCCESS_HREF = 'http://localhost/favicon-success.png';

const setFaviconLink = (href = DEFAULT_HREF) => {
  document.head.innerHTML = `<link rel="icon" id="favicon" href="${href}" type="image/png">`;
};

const faviconHref = () => document.querySelector<HTMLLinkElement>('#favicon')?.href ?? null;

const setLease = (tabId: string) => {
  mockReadGenerationLease.mockReturnValue({ tabId, generationId: 'gen-1', ts: Date.now() });
  mockIsGenerationLeaseFresh.mockReturnValue(true);
};

const clearLease = () => {
  mockReadGenerationLease.mockReturnValue(null);
};

const setDocumentHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
};

const fireVisibility = (hidden: boolean) => {
  setDocumentHidden(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
};

interface Props {
  isLoading: boolean;
  activeSessionId: string | null;
}

const render = (initial: Props) => {
  let props: Props = initial;
  const view = renderHook(() => useAppFavicon(props));
  const rerender = (next: Props) => {
    act(() => {
      props = next;
      view.rerender();
    });
  };
  return { rerender };
};

describe('getFaviconVisualState', () => {
  it('returns generating when armed and loading', () => {
    expect(getFaviconVisualState({ isLoading: true, armed: true })).toBe('generating');
  });

  it('returns success when armed and done loading', () => {
    expect(getFaviconVisualState({ isLoading: false, armed: true })).toBe('success');
  });

  it('returns default when not armed, regardless of loading', () => {
    expect(getFaviconVisualState({ isLoading: true, armed: false })).toBe('default');
    expect(getFaviconVisualState({ isLoading: false, armed: false })).toBe('default');
  });
});

describe('useAppFavicon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFaviconLink();
    setDocumentHidden(false);
    clearLease();
    mockIsGenerationLeaseFresh.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows generating while a locally-owned generation is in flight, then success on completion', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });

    rerender({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(GENERATING_HREF);

    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);
  });

  it('shows the generating variant immediately when mounted mid-generation this tab owns', () => {
    setLease('test-tab');
    render({ isLoading: true, activeSessionId: 'session-1' });

    expect(faviconHref()).toBe(GENERATING_HREF);
  });

  it('does not change the favicon for a generation owned by another tab', () => {
    setLease('other-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });

    rerender({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(DEFAULT_HREF);

    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(DEFAULT_HREF);
  });

  it('resets to the default favicon and clears armed state when the tab becomes visible', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);

    fireVisibility(true);
    expect(faviconHref()).toBe(SUCCESS_HREF);
    fireVisibility(false);
    expect(faviconHref()).toBe(DEFAULT_HREF);

    // After reset, a subsequent isLoading=false edge must not re-apply success
    // (armed was cleared) — proves armed is false, not just the href.
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(DEFAULT_HREF);
  });

  it('resets when the active session changes after a done state', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);

    rerender({ isLoading: false, activeSessionId: 'session-2' });
    expect(faviconHref()).toBe(DEFAULT_HREF);
  });

  it('switches to generating, then back to success across generation cycles', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);

    // A new generation replaces success with generating first, then completes to
    // success again.
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(GENERATING_HREF);

    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);
  });

  it('re-arms the generating variant when switching back to a session this tab is still generating', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(GENERATING_HREF);

    // Switch away to a session this tab is not generating → default.
    clearLease();
    rerender({ isLoading: true, activeSessionId: 'session-2' });
    expect(faviconHref()).toBe(DEFAULT_HREF);

    // Switch back to the still-generating session this tab owns → generating
    // is restored.
    setLease('test-tab');
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(GENERATING_HREF);
  });

  it('writes the href only once for repeated done transitions (idempotent)', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);

    const link = document.querySelector<HTMLLinkElement>('#favicon')!;
    const spy = vi.spyOn(link, 'href', 'set');

    // A second completion edge while already success must not re-write.
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    rerender({ isLoading: false, activeSessionId: 'session-1' });

    expect(spy).not.toHaveBeenCalled();
    expect(faviconHref()).toBe(SUCCESS_HREF);
  });
});

describe('isLocalGeneration', () => {
  it('returns true when a fresh lease matches the tab id', () => {
    mockReadGenerationLease.mockReturnValue({ tabId: 'test-tab', generationId: 'g', ts: Date.now() });
    mockIsGenerationLeaseFresh.mockReturnValue(true);
    expect(isLocalGeneration('session-1')).toBe(true);
  });

  it('returns false when the lease belongs to another tab', () => {
    mockReadGenerationLease.mockReturnValue({ tabId: 'other-tab', generationId: 'g', ts: Date.now() });
    expect(isLocalGeneration('session-1')).toBe(false);
  });

  it('returns false when there is no lease or no session', () => {
    mockReadGenerationLease.mockReturnValue(null);
    expect(isLocalGeneration('session-1')).toBe(false);
    expect(isLocalGeneration(null)).toBe(false);
  });

  it('returns false when the lease is stale', () => {
    mockReadGenerationLease.mockReturnValue({ tabId: 'test-tab', generationId: 'g', ts: 0 });
    mockIsGenerationLeaseFresh.mockReturnValue(false);
    expect(isLocalGeneration('session-1')).toBe(false);
  });
});
