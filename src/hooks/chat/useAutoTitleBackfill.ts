import { useEffect, useRef, useState } from 'react';
import { type AppSettings } from '@/types';
import { dbService } from '@/services/db/dbService';
import { logService } from '@/services/logService';
import { useChatStore } from '@/stores/chatStore';
import { autoTitleSession, isSessionAutoTitleEligible } from '@/features/auto-titling/autoTitleSession';

interface AutoTitleBackfillProps {
  appSettings: AppSettings;
  language: 'en' | 'zh';
}

export const useAutoTitleBackfill = ({ appSettings, language }: AutoTitleBackfillProps) => {
  const checkedMarkersRef = useRef<Map<string, string>>(new Map());
  const isProcessingRef = useRef(false);
  const rerunRequestedRef = useRef(false);
  const [, setRerunToken] = useState(0);

  const savedSessions = useChatStore((state) => state.savedSessions);
  const activeSessionId = useChatStore((state) => state.activeSessionId);
  const loadingSessionIds = useChatStore((state) => state.loadingSessionIds);
  const generatingTitleSessionIds = useChatStore((state) => state.generatingTitleSessionIds);

  useEffect(() => {
    if (!appSettings.isAutoTitleEnabled || isProcessingRef.current) {
      return;
    }

    const candidates = savedSessions.filter((session) => {
      if (session.id === activeSessionId) return false; // active chat handled by useAutoTitling
      if (loadingSessionIds.has(session.id)) return false;
      if (generatingTitleSessionIds.has(session.id)) return false;
      return checkedMarkersRef.current.get(session.id) !== `${session.title}|${session.timestamp}`;
    });

    if (candidates.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    let cancelled = false;

    const processCandidates = async () => {
      try {
        for (const candidate of candidates) {
          if (cancelled) {
            // A new effect run superseded this batch. Let that run pick up the
            // remainder instead of poking at stale store state.
            return;
          }

          checkedMarkersRef.current.set(candidate.id, `${candidate.title}|${candidate.timestamp}`);

          let fullSession;
          try {
            fullSession = await dbService.getSession(candidate.id);
          } catch (error) {
            logService.warn('Auto title backfill failed to load session.', { sessionId: candidate.id, error });
            continue;
          }

          if (!fullSession || !isSessionAutoTitleEligible(fullSession)) {
            continue;
          }

          useChatStore.getState().setGeneratingTitleSessionIds((prev) => new Set(prev).add(candidate.id));
          try {
            await autoTitleSession({
              session: fullSession,
              appSettings,
              language,
              updateAndPersistSessions: useChatStore.getState().updateAndPersistSessions,
            });
          } catch (error) {
            logService.warn('Auto title backfill failed for session.', { sessionId: candidate.id, error });
          } finally {
            useChatStore.getState().setGeneratingTitleSessionIds((prev) => {
              const next = new Set(prev);
              next.delete(candidate.id);
              return next;
            });
          }
        }
      } finally {
        isProcessingRef.current = false;

        // Another state change queued while this batch ran (e.g. a tab broadcast
        // a freshly-titled session). Re-run to pick it up rather than dropping it.
        if (rerunRequestedRef.current) {
          rerunRequestedRef.current = false;
          setRerunToken((token) => token + 1);
        }
      }
    };

    void processCandidates();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, appSettings, generatingTitleSessionIds, language, loadingSessionIds, savedSessions]);
};
