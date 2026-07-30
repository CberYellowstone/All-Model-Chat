import type { ChatSettings } from '@/types';
import { writeLastActiveSessionSnapshot } from '@/utils/chat/lastActiveSession';

interface LastActiveSessionSyncStore {
  subscribe: (
    listener: (state: {
      activeSessionId: string | null;
      savedSessions: Array<{ id: string; settings: ChatSettings }>;
    }) => void,
  ) => () => void;
}

/**
 * 监听 chatStore：活跃会话或其设置变化时，把快照同步写入 localStorage，
 * 供新打开的标签页继承当前页的模型与工具设置。
 */
export function setupLastActiveSessionSync(store: LastActiveSessionSyncStore): () => void {
  let lastWritten: { sessionId: string; settings: unknown } | null = null;

  return store.subscribe((state) => {
    const { activeSessionId, savedSessions } = state;

    if (!activeSessionId) {
      if (lastWritten) {
        lastWritten = null;
        writeLastActiveSessionSnapshot(null);
      }
      return;
    }

    const activeSession = savedSessions.find((session) => session.id === activeSessionId);
    if (!activeSession) return;

    if (lastWritten?.sessionId === activeSessionId && lastWritten.settings === activeSession.settings) {
      return;
    }

    lastWritten = { sessionId: activeSessionId, settings: activeSession.settings };
    writeLastActiveSessionSnapshot({
      sessionId: activeSessionId,
      settings: activeSession.settings,
    });
  });
}
