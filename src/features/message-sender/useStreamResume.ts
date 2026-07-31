import { type MutableRefObject, useCallback } from 'react';
import type { AppSettings, ChatSettings as IndividualChatSettings } from '@/types';
import { logService } from '@/services/logService';
import { isGeminiProxyRelativePath } from '@/services/api/geminiApiBaseUrl';
import { sendStatelessMessageStreamApi } from '@/services/api/chatApi';
import { createChatHistoryForApi } from '@/utils/chat/builder';
import { buildGenerationConfig } from '@/services/api/generationConfig';
import {
  getGeminiKeyForRequest,
  isServerManagedApiEnabledForProxyRequests,
  SERVER_MANAGED_API_KEY,
} from '@/utils/apiKeySelection';
import { TAB_ID } from '@/stores/tabIdentity';
import {
  isGenerationLeaseHeldByTab,
  releaseGenerationLease,
  startGenerationLeaseHeartbeat,
  stopGenerationLeaseHeartbeat,
  tryAcquireGenerationLease,
} from './generationLease';
import { startActiveGenerationJob, unregisterActiveGenerationJob } from './activeGenerationJobs';
import {
  readPendingStreamJob,
  clearPendingStreamJob,
  advancePendingStreamJobSeq,
} from '@/features/stream-jobs/amcStreamJobs';
import type { GetStreamHandlers } from './messageSenderTypes';

interface UseStreamResumeProps {
  appSettings: AppSettings;
  getStreamHandlers: GetStreamHandlers;
  activeJobs: MutableRefObject<Map<string, AbortController>>;
  sessionKeyMapRef: MutableRefObject<Map<string, string>>;
}

interface ResumeTarget {
  sessionId: string;
  generationId: string;
  modelId: string;
  startedAt: number;
  /** Full session settings so the API key can be re-resolved after a refresh. */
  sessionSettings?: IndividualChatSettings;
}

interface StreamResumeApi {
  /** Resume any pending stream job for the active session after a page load. */
  resumePendingStream: (target: ResumeTarget) => Promise<void>;
}
/**
 * After a page refresh, if the api container is still buffering an upstream
 * stream for this session (recorded in localStorage as a "pending stream
 * job"), reattach the same stream handlers and replay the buffered events from
 * the last seq the browser saw. Only engages when routing through the Docker
 * api container (relative /api/gemini); direct or absolute-proxy URLs bypass
 * the journal and resume is a no-op.
 */
export const useStreamResume = ({
  appSettings,
  getStreamHandlers,
  activeJobs,
  sessionKeyMapRef,
}: UseStreamResumeProps): StreamResumeApi => {
  // Resolve an API key for the resumed stream. After a full page refresh the
  // in-memory `sessionKeyMapRef` is empty, so fall back to server-managed
  // sentinel (Docker proxy holds the key) or BYOK rotation. We deliberately do
  // NOT persist the key map to storage — the codebase masks keys in storage
  // (maskApiKeyForStorage) and exposing a plaintext map would widen the XSS
  // surface; runtime re-resolution suffices.
  const resolveResumeKey = useCallback(
    (sessionId: string, sessionSettings: IndividualChatSettings): string | null => {
      const cachedKey = sessionKeyMapRef.current.get(sessionId);
      if (cachedKey) {
        return cachedKey;
      }

      if (isServerManagedApiEnabledForProxyRequests(appSettings)) {
        return SERVER_MANAGED_API_KEY;
      }

      const keyResult = getGeminiKeyForRequest(appSettings, sessionSettings, { skipIncrement: true });
      return 'error' in keyResult ? null : keyResult.key;
    },
    [appSettings, sessionKeyMapRef],
  );

  const resumePendingStream = useCallback(
    async (target: ResumeTarget) => {
      if (!isGeminiProxyRelativePath(appSettings)) {
        return;
      }

      const pending = readPendingStreamJob(target.sessionId);
      if (!pending || pending.generationId !== target.generationId) {
        return;
      }

      // If THIS tab already holds the generation lease for the session, the
      // original send is still running in this tab (runMessageLifecycle holds
      // the lease for the whole turn). Attaching a second stream handler would
      // deliver every buffered event twice. After a page refresh the lease
      // belongs to the old page and is stale, so this check does not block
      // genuine refresh-resume.
      if (isGenerationLeaseHeldByTab(target.sessionId)) {
        logService.info('Stream resume skipped: generation still in flight in this tab.', {
          sessionId: target.sessionId,
          generationId: pending.generationId,
        });
        return;
      }

      // Multi-tab guard: only the tab that started the job resumes it, so two
      // tabs never attach the same upstream job simultaneously.
      if (pending.tabId !== TAB_ID) {
        logService.info('Stream resume skipped: pending job belongs to another tab.', {
          sessionId: target.sessionId,
        });
        return;
      }

      const sessionSettings = target.sessionSettings ?? ({ modelId: target.modelId } as IndividualChatSettings);

      const key = resolveResumeKey(target.sessionId, sessionSettings);
      if (!key) {
        logService.warn('Stream resume skipped: no API key could be resolved for session.', {
          sessionId: target.sessionId,
        });
        clearPendingStreamJob(target.sessionId);
        return;
      }

      // Re-acquire the per-tab generation lease so other tabs keep seeing the
      // session as "generating elsewhere", then register the resumed job in
      // activeJobs so the stop button can abort it (local + server abort).
      if (!tryAcquireGenerationLease(target.sessionId, target.generationId)) {
        logService.warn('Stream resume skipped: generation lease held by another tab.', {
          sessionId: target.sessionId,
        });
        clearPendingStreamJob(target.sessionId);
        return;
      }

      const controller = new AbortController();
      startGenerationLeaseHeartbeat(target.sessionId, target.generationId);
      startActiveGenerationJob(activeJobs, target.sessionId, target.generationId, controller);

      const generationStartTime = new Date(target.startedAt);
      const handlers = getStreamHandlers(
        target.sessionId,
        target.generationId,
        controller,
        generationStartTime,
        sessionSettings,
        [],
      );

      try {
        await sendStatelessMessageStreamApi(
          key,
          target.modelId,
          await createChatHistoryForApi([], false, target.modelId),
          [],
          await buildGenerationConfig({ settings: sessionSettings, modelId: target.modelId }),
          controller.signal,
          handlers.streamOnPart,
          handlers.onThoughtChunk,
          handlers.streamOnError,
          handlers.streamOnComplete,
          'user',
          undefined,
          {
            jobId: pending.jobId,
            lastSeq: pending.lastSeq,
            onSeq: (seq) => advancePendingStreamJobSeq(target.sessionId, seq),
          },
        );
        logService.info('Stream resume completed.', { sessionId: target.sessionId });
      } catch (error) {
        logService.error('Stream resume failed.', error);
        clearPendingStreamJob(target.sessionId);
      } finally {
        stopGenerationLeaseHeartbeat(target.sessionId);
        releaseGenerationLease(target.sessionId, target.generationId);
        unregisterActiveGenerationJob(activeJobs, target.generationId);
      }
    },
    [appSettings, getStreamHandlers, activeJobs, resolveResumeKey],
  );

  return { resumePendingStream };
};
