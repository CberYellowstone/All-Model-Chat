import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import {
  isGenerationLeaseFresh,
  readGenerationLease,
  type GenerationLease,
} from '@/features/message-sender/generationLease';
import { TAB_ID } from '@/stores/tabIdentity';
import { getTintedFaviconUrl } from '@/utils/faviconTint';
import type { ChatMessage } from '@/types';

// Status colors applied to the favicon silhouette at runtime via canvas tinting.
// The favicon is the single source asset; no per-state PNGs are maintained.
const FAVICON_STATE_COLORS = {
  generating: '#4f7cf5',
  success: '#22c55e',
  error: '#ef4444',
} as const;
type FaviconState = keyof typeof FAVICON_STATE_COLORS;

type GenerationOutcome = 'success' | 'error' | 'stopped';

interface CompletionRecord {
  outcome: GenerationOutcome;
}

/**
 * Whether the in-flight generation for `sessionId` belongs to *this* tab.
 *
 * The lease is only written while a generation is running (it is released
 * before isLoading flips back to false), so this is the ownership guard that
 * keeps a cross-tab SESSION_LOADING broadcast from lighting this tab's favicon
 * for a generation another tab started. Signature unchanged so existing tests
 * and callers keep working.
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

/**
 * Classify how a local generation ended from its terminal model/error message:
 * an `error` role → error; a user-stopped turn → stopped (no badge); anything
 * else → success. Falls back to success when the message can't be found, since
 * the caller only reaches this path when a local generation truly completed.
 */
export const getOutcomeFromMessage = (
  message: Pick<ChatMessage, 'role' | 'stoppedByUser'> | undefined,
): GenerationOutcome => {
  if (!message) {
    return 'success';
  }
  if (message.role === 'error') {
    return 'error';
  }
  if (message.stoppedByUser) {
    return 'stopped';
  }
  return 'success';
};

/**
 * The last generation message (model or error) on the session, scanned from the
 * end so a trailing thought/internal turn never shadows the real outcome.
 */
const getLastGenerationMessage = (messages: ChatMessage[]): ChatMessage | undefined => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if ((message.role === 'model' || message.role === 'error') && message.generationStartTime) {
      return message;
    }
  }
  return undefined;
};

interface UseAppFaviconProps {
  activeSessionId: string | null;
}

/**
 * Derived-state favicon: `default` → `generating` → `success` | `error`.
 *
 * The favicon is rendered as a solid-color silhouette of the base icon, tinted
 * at runtime via canvas (`getTintedFaviconUrl`): blue while generating, green on
 * success, red on error. The base `#favicon` link href (respecting dev/prod
 * base paths) is the source asset; no per-state PNG files are maintained.
 *
 * There is no manual "armed" memory to get out of sync. On every relevant change
 * (active session, loading state) the hook re-derives:
 *
 *  - `generating` when this tab owns an in-flight generation for the active
 *    session. Derived from `loadingSessionIds.has(sid) && isLocalGeneration(sid)`,
 *    so it restores after a tab switch, a return to the tab, or a refresh
 *    (TAB_ID now persists across refresh, so the lease is still ours).
 *  - `success` | `error` for a completed *local* generation, classified from
 *    the terminal message. The badge persists as an "unread notification" —
 *    it stays until the user returns to the tab (visibilitychange → visible)
 *    or, if already on the tab, until the next click or keypress. A
 *    user-stopped turn produces no badge (straight to default).
 *  - `default` otherwise.
 *
 * Returning to the tab re-evaluates (rather than blindly clearing) so a still
 * in-flight generation keeps its generating favicon — the regression where
 * switching tabs mid-generation permanently broke the favicon is fixed by
 * removing the unconditional clear.
 */
export const useAppFavicon = ({ activeSessionId }: UseAppFaviconProps) => {
  const defaultHrefRef = useRef<string | null>(null);
  const stateHrefsRef = useRef<Partial<Record<FaviconState, string>>>({});
  const lastLocalRef = useRef<Map<string, boolean>>(new Map());
  const completionRef = useRef<({ sessionId: string } & CompletionRecord) | null>(null);

  const loadingSessionIds = useChatStore((state) => state.loadingSessionIds);
  const isLoading = activeSessionId ? loadingSessionIds.has(activeSessionId) : false;

  // Idempotent write so repeat transitions don't thrash the browser's favicon
  // renderer (which would flicker).
  const setFaviconHref = (href: string | null) => {
    const link = document.querySelector<HTMLLinkElement>('#favicon');
    if (!link || !href || link.href === href) {
      return;
    }
    link.href = href;
  };

  const getStateHref = (state: FaviconState): string | null => stateHrefsRef.current[state] ?? defaultHrefRef.current;

  const evaluate = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) {
        completionRef.current = null;
        setFaviconHref(defaultHrefRef.current);
        return;
      }

      const wasLocal = lastLocalRef.current.get(sessionId) ?? false;
      const genNow = useChatStore.getState().loadingSessionIds.has(sessionId) && isLocalGeneration(sessionId);

      if (genNow) {
        lastLocalRef.current.set(sessionId, true);
        completionRef.current = null;
        setFaviconHref(getStateHref('generating'));
        return;
      }

      // A local generation just finished on this frame: read the outcome from
      // the terminal message and show the matching badge for the TTL window.
      if (wasLocal) {
        lastLocalRef.current.set(sessionId, false);
        const lastMessage = getLastGenerationMessage(useChatStore.getState().activeMessages);
        const outcome = getOutcomeFromMessage(lastMessage);

        if (outcome === 'stopped') {
          completionRef.current = null;
          setFaviconHref(defaultHrefRef.current);
          return;
        }

        const outcomeState = outcome === 'error' ? 'error' : 'success';
        completionRef.current = { sessionId, outcome };
        setFaviconHref(getStateHref(outcomeState));
        // 不再按时间过期：徽标保留到用户回到标签页（visibilitychange）
        // 或在本页内的下一次点击/按键（见下方 interaction effect）。
        return;
      }

      // 保留未查看的完成徽标，直到用户回到标签页（visibilitychange）
      // 或在本页内下一次点击/按键。仅按 sessionId 匹配，无时间限制。
      if (completionRef.current?.sessionId === sessionId) {
        setFaviconHref(getStateHref(completionRef.current.outcome === 'error' ? 'error' : 'success'));
        return;
      }

      completionRef.current = null;
      setFaviconHref(defaultHrefRef.current);
    },
    // getStateHref reads refs that are mutated by the tinting effect below; it's
    // stable enough to omit, and including it would just churn the memo.
    [],
  );

  // Cache the default href once on mount, then pre-render the tinted silhouettes
  // for each state color. Tinting is async (canvas image decode); until it
  // resolves the hrefs fall back to the default, and once ready we re-evaluate
  // so a state that was pending display (e.g. mounted mid-generation) applies.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('#favicon');
    if (!link) {
      return;
    }
    defaultHrefRef.current = link.href;

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        (Object.entries(FAVICON_STATE_COLORS) as Array<[FaviconState, string]>).map(
          async ([state, color]) => [state, await getTintedFaviconUrl(link.href, color)] as const,
        ),
      );
      if (cancelled) {
        return;
      }
      for (const [state, url] of entries) {
        if (url) {
          stateHrefsRef.current[state] = url;
        }
      }
      evaluate(useChatStore.getState().activeSessionId);
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluate]);

  useEffect(() => {
    evaluate(activeSessionId);
  }, [activeSessionId, isLoading, evaluate]);

  // Returning to the tab re-evaluates rather than blindly clearing, so a still
  // in-flight generation keeps its generating favicon. (The regression where
  // switching tabs mid-generation permanently broke the favicon is fixed here.)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        return;
      }
      completionRef.current = null;
      evaluate(useChatStore.getState().activeSessionId);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [evaluate]);

  // 前台完成：标签页就在前台时，下一次点击或按键作为"已查看"信号，
  // 与 visibilitychange 路径对称——徽标只在用户交互后消失，无时间限制。
  useEffect(() => {
    const dismissOnInteraction = () => {
      if (document.hidden || !completionRef.current) {
        return;
      }
      completionRef.current = null;
      evaluate(useChatStore.getState().activeSessionId);
    };
    document.addEventListener('pointerdown', dismissOnInteraction);
    document.addEventListener('keydown', dismissOnInteraction);
    return () => {
      document.removeEventListener('pointerdown', dismissOnInteraction);
      document.removeEventListener('keydown', dismissOnInteraction);
    };
  }, [evaluate]);
};
