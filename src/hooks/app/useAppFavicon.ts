import { useCallback, useEffect, useRef } from 'react';
import {
  isGenerationLeaseFresh,
  readGenerationLease,
  type GenerationLease,
} from '@/features/message-sender/generationLease';
import { TAB_ID } from '@/stores/tabIdentity';

const SUCCESS_HREF = '/favicon-success.png';

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
 * Switches the page favicon to a "success" variant when a generation that
 * *this* tab started finishes, then resets it once the user returns to the
 * tab (or switches sessions, or starts a new generation). The armed flag is
 * kept in a ref (not React state) so it survives renders without retriggering
 * effects.
 *
 * The favicon <link id="favicon"> is taken as the source of truth for the
 * default href (captured on mount) so dev/production base paths are respected
 * rather than hard-coding "/favicon.png".
 */
export const useAppFavicon = ({ isLoading, activeSessionId }: UseAppFaviconProps) => {
  const defaultHrefRef = useRef<string | null>(null);
  const armedRef = useRef(false);
  const prevLoadingRef = useRef(false);

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

  const resetToFavicon = useCallback(() => {
    armedRef.current = false;
    setFaviconHref(defaultHrefRef.current);
  }, []);

  // arm/done: track the local generation lifecycle. The lease is only valid
  // at the moment isLoading flips to true (released before the false flip),
  // so capture ownership here, not on completion.
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;

    if (isLoading && !wasLoading) {
      // New generation starting. Reset any prior armed/done state first so a
      // previous success favicon doesn't persist into the next turn, then arm
      // if this tab owns the lease.
      setFaviconHref(defaultHrefRef.current);
      armedRef.current = isLocalGeneration(activeSessionId);
    }

    if (!isLoading && wasLoading && armedRef.current) {
      setFaviconHref(SUCCESS_HREF);
      // armed stays true so the success variant persists until a reset trigger.
    }

    prevLoadingRef.current = isLoading;
  }, [isLoading, activeSessionId]);

  // Reset trigger 1: user returns to the tab.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetToFavicon();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resetToFavicon]);

  // Reset trigger 2: switching sessions clears any armed/done state.
  useEffect(() => {
    resetToFavicon();
    // We intentionally re-run when the session id changes; prevLoadingRef is
    // reset too so the new session's first isLoading edge is treated as a
    // fresh arm, not a completion.
    prevLoadingRef.current = false;
  }, [activeSessionId, resetToFavicon]);
};
