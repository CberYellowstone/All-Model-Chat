import { type AppSettings, type SavedChatSession } from '@/types';
import { getGeminiKeyForRequest } from '@/utils/apiKeySelection';
import { generateTitleApi } from '@/services/api/generation/textApi';
import { generateSessionTitle } from '@/utils/chat/session';
import { getVisibleChatMessages } from '@/utils/chat/visibility';
import { dbService } from '@/services/db/dbService';
import { logService } from '@/services/logService';

export type AutoTitleSessionsUpdater = (
  updater: (prev: SavedChatSession[]) => SavedChatSession[],
  options?: { persist?: boolean },
) => void | Promise<void>;

interface AutoTitleExchange {
  userContent: string;
  modelContent: string;
}

const findFirstCompletedExchange = (session: SavedChatSession): AutoTitleExchange | null => {
  const messages = getVisibleChatMessages(session.messages);

  for (let index = 0; index < messages.length - 1; index += 1) {
    const userMessage = messages[index];
    const modelMessage = messages[index + 1];

    if (userMessage.role !== 'user' || modelMessage.role !== 'model') {
      continue;
    }
    if (modelMessage.isLoading || modelMessage.stoppedByUser) {
      continue;
    }

    return {
      userContent: userMessage.content,
      modelContent: modelMessage.content,
    };
  }

  return null;
};

export const isSessionAutoTitleEligible = (session: SavedChatSession): boolean => {
  if (session.title !== 'New Chat' && session.title !== generateSessionTitle(session.messages)) {
    return false;
  }

  return findFirstCompletedExchange(session) !== null;
};

interface AutoTitleSessionOptions {
  session: SavedChatSession;
  appSettings: AppSettings;
  language: 'en' | 'zh';
  stickyKey?: string;
  updateAndPersistSessions: AutoTitleSessionsUpdater;
}

export const autoTitleSession = async ({
  session,
  appSettings,
  language,
  stickyKey,
  updateAndPersistSessions,
}: AutoTitleSessionOptions): Promise<boolean> => {
  const sessionId = session.id;
  const exchange = findFirstCompletedExchange(session);

  if (!exchange) {
    return false;
  }

  if (!exchange.userContent.trim() && !exchange.modelContent.trim()) {
    logService.info(`Skipping title generation for session ${sessionId} due to empty content.`);
    return false;
  }

  let keyToUse: string;
  if (stickyKey) {
    keyToUse = stickyKey;
  } else {
    const keyResult = getGeminiKeyForRequest(appSettings, session.settings, { skipIncrement: true });
    if ('error' in keyResult) {
      logService.error(`Could not generate title for session ${sessionId}: ${keyResult.error}`);
      return false;
    }
    keyToUse = keyResult.key;
  }

  // Cross-tab dedup: reload from DB, skip if another tab already titled it.
  const freshSession = await dbService.getSession(sessionId);
  if (!freshSession) {
    logService.info(`Session ${sessionId} no longer exists; skipping title generation.`);
    return false;
  }

  const freshTitle = freshSession.title;
  if (freshTitle !== 'New Chat' && freshTitle !== generateSessionTitle(freshSession.messages)) {
    logService.info(`Session ${sessionId} already has a custom title; skipping title generation.`);
    return false;
  }

  logService.info(`Auto-generating title for session ${sessionId}`);

  try {
    const newTitle = await generateTitleApi(keyToUse, exchange.userContent, exchange.modelContent, language);

    if (newTitle && newTitle.trim()) {
      logService.info(`Generated new title for session ${sessionId}: "${newTitle}"`);
      updateAndPersistSessions((prev) =>
        prev.map((candidate) => (candidate.id === sessionId ? { ...candidate, title: newTitle.trim() } : candidate)),
      );
      return true;
    }

    logService.warn(`Title generation for session ${sessionId} returned an empty string.`);
  } catch (error) {
    logService.error(`Failed to auto-generate title for session ${sessionId}`, { error });
    const localTitle = generateSessionTitle(freshSession.messages);
    if (localTitle && localTitle !== 'New Chat' && localTitle !== freshTitle) {
      updateAndPersistSessions((prev) =>
        prev.map((candidate) => (candidate.id === sessionId ? { ...candidate, title: localTitle } : candidate)),
      );
      return true;
    }
  }

  return false;
};
