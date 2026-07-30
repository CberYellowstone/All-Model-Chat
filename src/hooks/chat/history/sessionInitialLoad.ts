import type { Dispatch, SetStateAction } from 'react';

import { ACTIVE_CHAT_SESSION_ID_KEY } from '@/constants/storageKeys';
import { dbService } from '@/services/db/dbService';
import { logService } from '@/services/logService';
import { readLastActiveSessionSnapshot } from '@/utils/chat/lastActiveSession';
import type { SetActiveSessionOptions } from '@/stores/chatStore';
import type { AppSettings, ChatGroup, ChatMessage, ChatSettings, SavedChatSession } from '@/types';
import { rehydrateSessionFiles } from '@/utils/chat/session';
import {
  createSettingsForNewChat,
  sanitizeSessionModel,
  sortSessionsByPinnedAndTimestamp,
} from './sessionLoaderSettings';
import { TAB_ID } from '@/stores/tabIdentity';

type SessionLoaderHistoryOptions = Pick<SetActiveSessionOptions, 'history'>;

interface LoadInitialSessionDataOptions {
  appSettings: AppSettings;
  setSavedSessions: Dispatch<SetStateAction<SavedChatSession[]>>;
  setSavedGroups: Dispatch<SetStateAction<ChatGroup[]>>;
  setActiveSessionId: (value: SetStateAction<string | null>, options?: SetActiveSessionOptions) => void;
  setActiveMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  restoreDraftFiles: (sessionId: string) => void;
  updateAndPersistSessions: (
    updater: (prev: SavedChatSession[]) => SavedChatSession[],
    options?: { persist?: boolean },
  ) => void | Promise<void>;
  startNewChat: (explicitTemplateSession?: SavedChatSession, options?: SessionLoaderHistoryOptions) => void;
}

const inheritAppSystemInstructionForEmptySession = (
  session: SavedChatSession,
  appSettings: AppSettings,
  savedSessions: SavedChatSession[],
): { session: SavedChatSession; settingsChanged: boolean } => {
  if (session.messages.length > 0 || session.settings.systemInstruction?.trim() || session.createdTabId !== TAB_ID) {
    return { session, settingsChanged: false };
  }

  const inheritedSettings: ChatSettings = createSettingsForNewChat({
    appSettings,
    savedSessions,
    excludeTemplateSessionId: session.id,
  });
  // Keep the empty session's already-chosen model/thinking controls; only fill missing SI + related app defaults.
  const nextSettings: ChatSettings = {
    ...session.settings,
    systemInstruction: inheritedSettings.systemInstruction,
  };

  if (nextSettings.systemInstruction === session.settings.systemInstruction) {
    return { session, settingsChanged: false };
  }

  return {
    session: { ...session, settings: nextSettings },
    settingsChanged: true,
  };
};

const resolveInitialActiveSessionId = (metadataList: SavedChatSession[]) => {
  const urlMatch = window.location.pathname.match(/^\/chat\/([^/]+)$/);
  const urlSessionId = urlMatch ? urlMatch[1] : null;

  if (urlSessionId && metadataList.some((session) => session.id === urlSessionId)) {
    return urlSessionId;
  }

  const storedActiveId = sessionStorage.getItem(ACTIVE_CHAT_SESSION_ID_KEY);
  if (storedActiveId && metadataList.some((session) => session.id === storedActiveId)) {
    return storedActiveId;
  }

  return null;
};

const mergeLoadedSessionMetadata = (
  currentSessions: SavedChatSession[],
  sortedMetadata: SavedChatSession[],
): SavedChatSession[] => {
  if (currentSessions.length === 0) {
    return sortedMetadata;
  }

  const currentById = new Map(currentSessions.map((session) => [session.id, session]));
  const merged = sortedMetadata.map((session) => {
    const existing = currentById.get(session.id);

    if (!existing) {
      return session;
    }

    currentById.delete(session.id);
    return {
      ...session,
      ...existing,
      createdTabId: existing.createdTabId || session.createdTabId,
      settings: {
        ...session.settings,
        ...existing.settings,
      },
      messages: existing.messages ?? session.messages,
    };
  });

  return sortSessionsByPinnedAndTimestamp([...merged, ...currentById.values()]);
};

export const loadInitialSessionData = async ({
  appSettings,
  setSavedSessions,
  setSavedGroups,
  setActiveSessionId,
  setActiveMessages,
  restoreDraftFiles,
  updateAndPersistSessions,
  startNewChat,
}: LoadInitialSessionDataOptions) => {
  try {
    logService.info('Attempting to load chat history metadata from IndexedDB.');

    const [metadataList, groups] = await Promise.all([dbService.getAllSessionMetadata(), dbService.getAllGroups()]);

    let initialActiveId = resolveInitialActiveSessionId(metadataList);

    if (initialActiveId) {
      const fullActiveSession = await dbService.getSession(initialActiveId);
      if (fullActiveSession) {
        logService.info(`Loaded full content for active session: ${initialActiveId}`);
        const rehydrated = rehydrateSessionFiles(sanitizeSessionModel(fullActiveSession));
        setActiveMessages(rehydrated.messages);
        setActiveSessionId(initialActiveId, { history: 'replace' });
        restoreDraftFiles(initialActiveId);
      } else {
        initialActiveId = null;
      }
    }

    const sortedList = sortSessionsByPinnedAndTimestamp(metadataList.map(sanitizeSessionModel));

    setSavedSessions((prev) => mergeLoadedSessionMetadata(prev, sortedList));
    setSavedGroups(groups.map((group) => ({ ...group, isExpanded: group.isExpanded ?? true })));

    if (!initialActiveId) {
      const mostRecent = sortedList[0];
      let reused = false;

      if (mostRecent) {
        const fullSession = await dbService.getSession(mostRecent.id);
        if (
          fullSession &&
          fullSession.messages.length === 0 &&
          !fullSession.settings.systemInstruction &&
          (fullSession.createdTabId === TAB_ID || !fullSession.createdTabId)
        ) {
          logService.info(`Reusing empty recent session: ${mostRecent.id}`);
          const rehydratedBase = rehydrateSessionFiles(sanitizeSessionModel(fullSession));
          const { session: rehydrated, settingsChanged } = inheritAppSystemInstructionForEmptySession(
            rehydratedBase,
            appSettings,
            sortedList,
          );
          setActiveMessages(rehydrated.messages);
          setActiveSessionId(rehydrated.id, { history: 'replace' });
          restoreDraftFiles(rehydrated.id);
          if (settingsChanged) {
            void updateAndPersistSessions((prev) =>
              prev.map((session) =>
                session.id === rehydrated.id ? { ...session, settings: rehydrated.settings } : session,
              ),
            );
          }

          reused = true;
        }
      }

      if (!reused) {
        logService.info('No active session found or empty session to reuse, starting fresh chat.');

        // 优先以"最后活跃会话"（即点击 Logo 时所在页面）作为模板。
        const lastActiveSnapshot = readLastActiveSessionSnapshot();
        let templateSession: SavedChatSession | undefined;

        if (lastActiveSnapshot) {
          const existing = sortedList.find((session) => session.id === lastActiveSnapshot.sessionId);
          templateSession = existing
            ? { ...existing, settings: lastActiveSnapshot.settings } // 用最新快照设置覆盖（源页可能刚改过设置）
            : {
                id: lastActiveSnapshot.sessionId,
                title: 'New Chat',
                timestamp: Date.now(),
                messages: [],
                settings: lastActiveSnapshot.settings,
              };
        }

        startNewChat(templateSession ?? sortedList[0], { history: 'replace' });
      }
    }
  } catch (error) {
    logService.error('Error loading chat history:', error);
    startNewChat(undefined, { history: 'replace' });
  }
};
