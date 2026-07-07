import { useChatStore } from '@/stores/chatStore';
import type { SessionsUpdater } from './messageSenderTypes';

export const createSenderStoreActions = () => {
  const getStore = () => useChatStore.getState();

  return {
    updateAndPersistSessions: ((updater, options) =>
      getStore().updateAndPersistSessions(updater, options)) as SessionsUpdater,
    setActiveSessionId: (id: string | null) => getStore().setActiveSessionId(id),
    setSessionLoading: (sessionId: string, isLoading: boolean) =>
      getStore().setSessionLoading(sessionId, isLoading),
    activeJobs: getStore()._activeJobs,
  };
};
