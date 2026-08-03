import { renderHookWithProviders } from '@/test/render/providerRenderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  handleApiErrorMock,
  updateMessageInSessionMock,
  updateSessionByIdMock,
  finalizeMessagesMock,
  finishActiveGenerationJobMock,
  clearOwnedPendingStreamJobMock,
  logWarnMock,
} = vi.hoisted(() => ({
  handleApiErrorMock: vi.fn(),
  updateMessageInSessionMock: vi.fn(),
  updateSessionByIdMock: vi.fn(),
  finalizeMessagesMock: vi.fn(),
  finishActiveGenerationJobMock: vi.fn(),
  clearOwnedPendingStreamJobMock: vi.fn(),
  logWarnMock: vi.fn(),
}));

vi.mock('./useApiErrorHandler', () => ({
  useApiErrorHandler: () => ({ handleApiError: handleApiErrorMock }),
}));

vi.mock('@/utils/chat/sessionMutations', () => ({
  updateMessageInSession: updateMessageInSessionMock,
  updateSessionById: updateSessionByIdMock,
}));

vi.mock('@/features/chat-streaming/processors', () => ({
  finalizeMessages: finalizeMessagesMock,
}));

vi.mock('./activeGenerationJobs', () => ({
  finishActiveGenerationJob: finishActiveGenerationJobMock,
}));

vi.mock('@/features/stream-jobs/amcStreamJobs', () => ({
  clearOwnedPendingStreamJob: clearOwnedPendingStreamJobMock,
}));

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');
  return createLogServiceMockModule({ warn: logWarnMock });
});

vi.mock('@/services/streamingStore', () => ({
  streamingStore: { updateContent: vi.fn(), updateThoughts: vi.fn(), clear: vi.fn() },
}));

vi.mock('@/utils/model/modelUsageStats', () => ({
  calculateTokenStats: vi.fn(() => ({})),
}));

vi.mock('@/utils/usagePricingTelemetry', () => ({
  buildExactPricingFromUsageMetadata: vi.fn(() => ({})),
}));

vi.mock('@/utils/chatPricingEvidence', () => ({
  resolveChatExactPricing: vi.fn(() => ({})),
}));

vi.mock('@/i18n/translations', () => ({
  getTranslator: () => () => '',
}));

vi.mock('./completionFeedback', () => ({
  emitCompletionFeedback: vi.fn(),
  buildCompletionNotificationBody: vi.fn(() => ({})),
}));

vi.mock('@/utils/deferToNextTick', () => ({
  deferToNextTick: vi.fn((cb: () => void) => cb()),
}));

import { useChatStreamHandler } from './useChatStreamHandler';
import { DEFAULT_APP_SETTINGS } from '@/constants/settingsDefaults';

describe('useChatStreamHandler empty-reply guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finalizeMessagesMock.mockImplementation(({ messages }) => ({ updatedMessages: messages }));
  });

  const renderHandler = () =>
    renderHookWithProviders(() =>
      useChatStreamHandler({
        appSettings: { ...DEFAULT_APP_SETTINGS, language: 'zh' },
        updateAndPersistSessions: vi.fn(),
        setSessionLoading: vi.fn(),
        activeJobs: { current: new Map() },
      }),
    );

  const getHandlers = () => {
    const { result } = renderHandler();
    return result.current.getStreamHandlers(
      'session-1',
      'generation-1',
      new AbortController(),
      new Date(),
      {
        modelId: 'gemini-3.6-flash',
        temperature: 1,
        topP: 0.95,
        thinkingLevel: 'HIGH',
        thinkingBudget: -1,
      } as never,
    );
  };

  it('routes an empty reply (only thoughts, no content) through the error path', () => {
    const { streamOnComplete, onThoughtChunk } = getHandlers();

    // Simulate a stream that only produced thoughts, no content part.
    onThoughtChunk('Analyzing the query...');
    streamOnComplete(undefined, undefined, undefined, undefined);

    expect(handleApiErrorMock).toHaveBeenCalledTimes(1);
    const [error] = handleApiErrorMock.mock.calls[0];
    expect(error.name).toBe('EmptyReplyError');
    expect(finishActiveGenerationJobMock).toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Empty reply detected'),
    );
  });

  it('does not treat an empty reply as an error when a meaningful part was received', () => {
    const { streamOnComplete, streamOnPart } = getHandlers();

    streamOnPart({ text: 'Hello from the model' });
    streamOnComplete(undefined, undefined, undefined, undefined);

    expect(handleApiErrorMock).not.toHaveBeenCalled();
  });

  it('does not route aborted streams through the empty-reply error path', () => {
    const controller = new AbortController();
    const { result } = renderHandler();
    const handlers = result.current.getStreamHandlers(
      'session-1',
      'generation-1',
      controller,
      new Date(),
      { modelId: 'gemini-3.6-flash' } as never,
    );

    controller.abort();
    handlers.streamOnComplete(undefined, undefined, undefined, undefined);

    expect(handleApiErrorMock).not.toHaveBeenCalled();
  });
});
