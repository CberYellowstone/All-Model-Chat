import { create } from 'zustand';
import {
  type SavedChatSession,
  type ChatGroup,
  type ChatMessage,
  type UploadedFile,
  type ChatSettingsUpdater,
} from '@/types';
import { dbService } from '@/services/db/dbService';
import { logService } from '@/services/logService';
import { rehydrateSessionFiles } from '@/utils/chat/session';
import { syncActiveSessionRoute, type SessionHistoryMode } from './sessionRouteSync';
import { broadcastSyncMessage } from './chatSyncChannel';
import { TAB_ID } from './tabIdentity';
import { sanitizeSessionModel, sortSessionsInPlace } from './sessionModels';
import {
  updateMessageInSession as updateMessageInSessions,
  updateSessionById as updateSessionByIdInSessions,
} from '@/utils/chat/sessionMutations';
import { mergeSessionMetadata } from './sessionRefresh';
import {
  createVirtualFullSessions,
  getSessionPersistenceChanges,
  stripStoredSessionMessages,
} from './sessionPersistence';
import { persistSessionChanges } from './sessionPersistenceEffects';
import { setupChatStoreSync } from './chatStoreSync';
import { setupLastActiveSessionSync } from './lastActiveSessionSync';
import { createChatUiSlice, type ChatUiSliceActions, type ChatUiSliceState } from './chatStoreSlices';
import { resolveUpdaterOrValue, type UpdaterOrValue } from './stateUpdaters';

type SessionUpdateOptions = { persist?: boolean };
type MessagePatchOrUpdater = Partial<ChatMessage> | ((message: ChatMessage) => ChatMessage);
export type { SessionHistoryMode };
export interface SetActiveSessionOptions {
  history?: SessionHistoryMode;
}

const _activeJobs: { current: Map<string, AbortController> } = { current: new Map() };
const _userScrolledUp: { current: boolean } = { current: false };
const _fileDrafts: { current: Record<string, UploadedFile[]> } = { current: {} };
const _localLoadingSessionIds = new Set<string>();
const _sessionPersistVersion = new Map<string, number>();
let _fileOperationGeneration = 0;

interface ChatState extends ChatUiSliceState {
  savedSessions: SavedChatSession[];
  savedGroups: ChatGroup[];
  activeSessionId: string | null;
  activeMessages: ChatMessage[];

  _activeJobs: { current: Map<string, AbortController> };
  _userScrolledUp: { current: boolean };
  _fileDrafts: { current: Record<string, UploadedFile[]> };
}

interface ChatActions extends ChatUiSliceActions {
  setSavedSessions: (value: UpdaterOrValue<SavedChatSession[]>) => void;
  setSavedGroups: (value: UpdaterOrValue<ChatGroup[]>) => void;
  setActiveSessionId: (id: UpdaterOrValue<string | null>, options?: SetActiveSessionOptions) => void;
  setActiveMessages: (value: UpdaterOrValue<ChatMessage[]>) => void;

  updateAndPersistSessions: (
    updater: (prev: SavedChatSession[]) => SavedChatSession[],
    options?: SessionUpdateOptions,
  ) => void;
  updateSessionById: (
    sessionId: string,
    updater: (session: SavedChatSession) => SavedChatSession,
    options?: SessionUpdateOptions,
  ) => void;
  updateActiveSession: (
    updater: (session: SavedChatSession) => SavedChatSession,
    options?: SessionUpdateOptions,
  ) => void;
  updateMessageInSession: (
    sessionId: string,
    messageId: string,
    updater: MessagePatchOrUpdater,
    options?: SessionUpdateOptions,
  ) => void;
  updateMessageInActiveSession: (
    messageId: string,
    updater: MessagePatchOrUpdater,
    options?: SessionUpdateOptions,
  ) => void;
  appendMessageToSession: (sessionId: string, message: ChatMessage, options?: SessionUpdateOptions) => void;
  appendMessageToActiveSession: (message: ChatMessage, options?: SessionUpdateOptions) => void;
  updateAndPersistGroups: (updater: (prev: ChatGroup[]) => ChatGroup[]) => void;
  refreshSessions: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  setSessionLoading: (sessionId: string, isLoading: boolean) => void;
  markSessionCompleted: (sessionId: string, outcome: 'success' | 'error') => void;
  markSessionViewed: (sessionId: string) => void;
  getFileOperationGeneration: () => number;
  invalidateFileOperations: () => void;

  setCurrentChatSettings: ChatSettingsUpdater;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  savedSessions: [],
  savedGroups: [],
  activeSessionId: null,
  activeMessages: [],

  ...createChatUiSlice<ChatState & ChatActions>(set),

  _activeJobs,
  _userScrolledUp,
  _fileDrafts,

  setSavedSessions: (value) =>
    set((state) => ({
      savedSessions: resolveUpdaterOrValue(value, state.savedSessions),
    })),

  setSavedGroups: (value) =>
    set((state) => ({
      savedGroups: resolveUpdaterOrValue(value, state.savedGroups),
    })),

  setActiveSessionId: (value, options) => {
    const nextValue = resolveUpdaterOrValue(value, get().activeSessionId);
    set({ activeSessionId: nextValue });
    syncActiveSessionRoute(nextValue, options?.history ?? 'auto');
  },

  setActiveMessages: (value) =>
    set((state) => ({
      activeMessages: resolveUpdaterOrValue(value, state.activeMessages),
    })),

  refreshSessions: async () => {
    try {
      const metadataList = await dbService.getAllSessionMetadata();
      const { activeSessionId, loadingSessionIds, setActiveMessages, setSavedSessions } = get();

      if (activeSessionId && !loadingSessionIds.has(activeSessionId)) {
        const fullActiveSession = await dbService.getSession(activeSessionId);
        if (fullActiveSession) {
          const rehydrated = rehydrateSessionFiles(sanitizeSessionModel(fullActiveSession));
          setActiveMessages(rehydrated.messages);
        }
      }

      setSavedSessions((prev) =>
        mergeSessionMetadata(prev, metadataList, {
          activeSessionId,
          loadingSessionIds,
        }),
      );
    } catch (refreshError) {
      logService.error('Failed to refresh sessions from DB', { error: refreshError });
    }
  },

  refreshGroups: async () => {
    try {
      const groups = await dbService.getAllGroups();
      set({ savedGroups: groups });
    } catch (refreshError) {
      logService.error('Failed to refresh groups from DB', { error: refreshError });
    }
  },

  setSessionLoading: (sessionId, isLoading) => {
    if (isLoading) {
      _localLoadingSessionIds.add(sessionId);
    } else {
      _localLoadingSessionIds.delete(sessionId);
    }

    set((state) => {
      const next = new Set(state.loadingSessionIds);
      if (isLoading) next.add(sessionId);
      else next.delete(sessionId);

      const nextSavedSessions =
        !isLoading && sessionId !== state.activeSessionId
          ? state.savedSessions.map((session) =>
              session.id === sessionId && session.messages.length > 0 ? { ...session, messages: [] } : session,
            )
          : state.savedSessions;

      // 新一轮生成使旧的完成标记失效:本地清除即可(不广播,新一轮完成时会
      // 重新广播新的完成状态)。若该会话正好没有旧标记则保持原对象避免重渲染。
      const completedSessions =
        isLoading && sessionId in state.completedSessions
          ? Object.fromEntries(Object.entries(state.completedSessions).filter(([key]) => key !== sessionId))
          : state.completedSessions;

      return {
        loadingSessionIds: next,
        savedSessions: nextSavedSessions,
        completedSessions,
      };
    });

    broadcastSyncMessage({
      type: 'SESSION_LOADING',
      sessionId,
      isLoading,
      originId: TAB_ID,
      ts: Date.now(),
    });
  },

  markSessionCompleted: (sessionId, outcome) => {
    // 广播总是发送,让其他标签页各自判断是否需要显示(他们可能不在该会话页)。
    broadcastSyncMessage({ type: 'SESSION_COMPLETED', sessionId, outcome });
    // 本标签页正在实时观看该会话的生成完成,不需要提醒,跳过本地写入。
    if (get().activeSessionId === sessionId) {
      return;
    }
    set((state) => ({
      completedSessions: { ...state.completedSessions, [sessionId]: outcome },
    }));
  },

  markSessionViewed: (sessionId) => {
    broadcastSyncMessage({ type: 'SESSION_VIEWED', sessionId });
    set((state) => {
      if (!(sessionId in state.completedSessions)) {
        return state;
      }
      const next = { ...state.completedSessions };
      delete next[sessionId];
      return { completedSessions: next };
    });
  },

  getFileOperationGeneration: () => _fileOperationGeneration,

  invalidateFileOperations: () => {
    _fileOperationGeneration += 1;
  },

  updateAndPersistSessions: (updater, options = {}) => {
    const { persist = true } = options;
    const { savedSessions, activeSessionId, activeMessages, loadingSessionIds } = get();

    const virtualFullSessions = createVirtualFullSessions(savedSessions, activeSessionId, activeMessages);

    const newFullSessions = updater(virtualFullSessions);

    sortSessionsInPlace(newFullSessions);

    if (activeSessionId) {
      const newActiveSession = newFullSessions.find((session) => session.id === activeSessionId);
      if (newActiveSession && newActiveSession.messages !== activeMessages) {
        set({ activeMessages: newActiveSession.messages });
      }
    }

    if (persist) {
      const { modifiedSessions, deletedSessionIds } = getSessionPersistenceChanges(
        virtualFullSessions,
        newFullSessions,
      );

      if (modifiedSessions.length > 0 || deletedSessionIds.length > 0) {
        void persistSessionChanges({
          modifiedSessions,
          deletedSessionIds,
          activeSessionId,
          sessionPersistVersions: _sessionPersistVersion,
          getSession: dbService.getSession.bind(dbService),
          saveSession: dbService.saveSession.bind(dbService),
          deleteSession: dbService.deleteSession.bind(dbService),
          broadcastSyncMessage,
        }).catch((persistenceError) =>
          logService.error('Failed to persist session updates', { error: persistenceError }),
        );
      }
    }

    const metadataOnly = stripStoredSessionMessages(newFullSessions, activeSessionId, loadingSessionIds);

    // 会话被删除后不应残留完成标记(删除通过 updater 里的 filter 完成)。
    // 常见路径(无删除)保持原对象引用,避免无谓重渲染。
    const completedSessionIds = new Set(
      virtualFullSessions
        .map((session) => session.id)
        .filter((sessionId) => !newFullSessions.some((session) => session.id === sessionId)),
    );
    set((state) => ({
      savedSessions: metadataOnly,
      completedSessions:
        completedSessionIds.size > 0
          ? Object.fromEntries(Object.entries(state.completedSessions).filter(([key]) => !completedSessionIds.has(key)))
          : state.completedSessions,
    }));
  },

  updateSessionById: (sessionId, updater, options) => {
    get().updateAndPersistSessions(
      (prevSessions) => updateSessionByIdInSessions(prevSessions, sessionId, updater),
      options,
    );
  },

  updateActiveSession: (updater, options) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    get().updateSessionById(activeSessionId, updater, options);
  },

  updateMessageInSession: (sessionId, messageId, updater, options) => {
    get().updateSessionById(
      sessionId,
      (session) => updateMessageInSessions([session], sessionId, messageId, updater)[0],
      options,
    );
  },

  updateMessageInActiveSession: (messageId, updater, options) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    get().updateMessageInSession(activeSessionId, messageId, updater, options);
  },

  appendMessageToSession: (sessionId, message, options) => {
    get().updateSessionById(
      sessionId,
      (session) => ({
        ...session,
        messages: [...session.messages, message],
        timestamp: Date.now(),
      }),
      options,
    );
  },

  appendMessageToActiveSession: (message, options) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    get().appendMessageToSession(activeSessionId, message, options);
  },

  updateAndPersistGroups: (updater) => {
    const { savedGroups } = get();
    const newGroups = updater(savedGroups);
    dbService
      .setAllGroups(newGroups)
      .then(() => broadcastSyncMessage({ type: 'GROUPS_UPDATED' }))
      .catch((persistenceError) => logService.error('Failed to persist group updates', { error: persistenceError }));
    set({ savedGroups: newGroups });
  },

  setCurrentChatSettings: (updater) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    get().updateAndPersistSessions((prevSessions) =>
      updateSessionByIdInSessions(prevSessions, activeSessionId, (session) => ({
        ...session,
        settings: updater(session.settings),
      })),
    );
  },
}));

setupChatStoreSync({
  store: useChatStore,
  localLoadingSessionIds: _localLoadingSessionIds,
  activeJobs: _activeJobs,
});
setupLastActiveSessionSync(useChatStore);
