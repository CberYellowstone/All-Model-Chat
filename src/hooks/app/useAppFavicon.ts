import { useCallback, useEffect, useRef } from 'react';
import {
  isGenerationLeaseFresh,
  readGenerationLease,
  type GenerationLease,
} from '@/features/message-sender/generationLease';
import { TAB_ID } from '@/stores/tabIdentity';

const SUCCESS_HREF = '/favicon-success.png';
const GENERATING_HREF = '/favicon-generating.png';

/** Visual favicon state derived from the local-generation lifecycle. */
export type FaviconVisualState = 'default' | 'generating' | 'success';

/**
 * Pure mapping from the local-generation lifecycle to a favicon visual state.
 *
 * `armed` means this tab owns an in-flight or just-finished generation. While
 * that owned generation is in flight → `generating`; once it finishes →
 * `success`; anything else (not armed, or reset) → `default`. Extracted as a
 * pure function so the state machine is unit-testable without a DOM.
 */
export const getFaviconVisualState = ({
  isLoading,
  armed,
}: {
  isLoading: boolean;
  armed: boolean;
}): FaviconVisualState => {
  if (!armed) {
    return 'default';
  }
  return isLoading ? 'generating' : 'success';
};

/**
 * Whether the in-flight generation for `sessionId` belongs to *this* tab.
 *
 * `finishActiveGenerationJob` releases the lease before it flips isLoading to
 * false, so the ownership check is only meaningful while a generation is
 * starting (the caller arms before the lease is released). Cross-tab
 * SESSION_LOADING sync will make this tab see a remote isLoading=true; this
 * guard is what keeps that remote generation from lighting this tab's favicon.
 */
export const isLocalGeneration = (
  sessionId: string | null,
  deps: { readLease?: typeof readGenerationLease; isFresh?: typeof isGenerationLeaseFresh; tabId?: string } = {},
): boolean => {
  if (!sessionId) {
    return false;
  }
  const readLease = deps.readLease ?? readGenerationLease;
  const isFresh = deps.isFresh ?? isGenerationLeaseFresh;
  const tabId = deps.tabId ?? TAB_ID;

  const lease = readLease(sessionId) as GenerationLease | null;
  return Boolean(lease && isFresh(lease) && lease.tabId === tabId);
};

interface UseAppFaviconProps {
  isLoading: boolean;
  activeSessionId: string | null;
}

/**
 * Drives a three-state favicon: `default` → `generating` → `success`.
 *
 * When a generation *this* tab started is in flight, the favicon switches to
 * the generating variant; when it finishes, to the success variant; any reset
 * trigger (returning to the tab, switching sessions, a new generation starting)
 * clears back to default. Switching back to a session this tab is still
 * generating for re-arms the generating variant.
 *
 * The armed flag lives in a ref (not React state) so it survives renders
 * without retriggering effects. The favicon `<link id="favicon">` is the source
 * of truth for the default href (captured on mount) so dev/production base
 * paths are respected rather than hard-coding "/favicon.png".
 */
export const useAppFavicon = ({ isLoading, activeSessionId }: UseAppFaviconProps) => {
  const defaultHrefRef = useRef<string | null>(null);
  const armedRef = useRef(false);
  const prevLoadingRef = useRef(false);
  const prevSessionIdRef = useRef<string | null>(null);

  // Cache the default href once on mount. Everything resets to this value.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('#favicon');
    if (link) {
      defaultHrefRef.current = link.href;
    }
  }, []);

  // Write helper: idempotent so repeat transitions don't thrash the browser's
  // favicon renderer (which would flicker).
  const setFaviconHref = (href: string | null) => {
    const link = document.querySelector<HTMLLinkElement>('#favicon');
    if (!link || !href) {
      return;
    }
    if (link.href === href) {
      return;
    }
    link.href = href;
  };

  const hrefForState = (state: FaviconVisualState): string | null => {
    switch (state) {
      case 'generating':
        return GENERATING_HREF;
      case 'success':
        return SUCCESS_HREF;
      default:
        return defaultHrefRef.current;
    }
  };

  const resetToFavicon = useCallback(() => {
    armedRef.current = false;
    setFaviconHref(defaultHrefRef.current);
  }, []);

  // Lifecycle + session handling, unified in one effect so there is no ordering
  // race between a session reset and the isLoading edge that re-arms a
  // still-generating session.
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    const sessionChanged = prevSessionIdRef.current !== activeSessionId;

    if (sessionChanged) {
      // (Re)establish state for the session we just landed on. If this tab owns
      // an in-flight generation here, arm and show generating immediately; the
      // lease is only consultable while the generation is still running.
      armedRef.current = isLoading ? isLocalGeneration(activeSessionId) : false;
      prevLoadingRef.current = isLoading;
      prevSessionIdRef.current = activeSessionId;
      setFaviconHref(hrefForState(getFaviconVisualState({ isLoading, armed: armedRef.current })));
      return;
    }

    // Same session: drive the favicon off isLoading edges only. Ownership is
    // only knowable at the moment a generation starts (the lease is released
    // before isLoading flips back to false), so (re)arm on the rising edge.
    if (isLoading && !wasLoading) {
      armedRef.current = isLocalGeneration(activeSessionId);
      setFaviconHref(hrefForState(getFaviconVisualState({ isLoading: true, armed: armedRef.current })));
    } else if (!isLoading && wasLoading && armedRef.current) {
      setFaviconHref(hrefForState(getFaviconVisualState({ isLoading: false, armed: true })));
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, activeSessionId]);

  // Reset trigger: user returns to the tab. (Session changes and new
  // generations are handled by the lifecycle effect above.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetToFavicon();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resetToFavicon]);
};
