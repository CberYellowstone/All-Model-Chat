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

import { useAppFavicon, isLocalGeneration } from './useAppFavicon';

const DEFAULT_HREF = 'http://localhost/favicon.png';
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

  it('switches to the success variant when a locally-owned generation finishes', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });

    rerender({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(DEFAULT_HREF);

    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);
  });

  it('does not change the favicon for a generation owned by another tab', () => {
    setLease('other-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });

    rerender({ isLoading: true, activeSessionId: 'session-1' });
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

  it('resets before arming a new generation, then re-applies success on completion', () => {
    setLease('test-tab');
    const { rerender } = render({ isLoading: false, activeSessionId: 'session-1' });
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);

    // New generation starts: must reset to default first, then arm.
    rerender({ isLoading: true, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(DEFAULT_HREF);

    // And complete again → success.
    rerender({ isLoading: false, activeSessionId: 'session-1' });
    expect(faviconHref()).toBe(SUCCESS_HREF);
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
