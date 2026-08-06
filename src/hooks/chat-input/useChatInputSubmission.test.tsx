import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppSettings, createChatSettings, createUploadedFile } from '@/test/data/factories';
import { renderHook } from '@/test/render/renderer';
import { useChatStore } from '@/stores/chatStore';
import type { UploadedFile } from '@/types';
import { useChatInputSubmission } from './useChatInputSubmission';

const createSubmissionParams = () => {
  const textarea = document.createElement('textarea');

  return {
    activeSessionId: 'session-1',
    appSettings: createAppSettings(),
    currentChatSettings: createChatSettings(),
    selectedFiles: [] as UploadedFile[],
    setSelectedFiles: vi.fn(),
    setAppFileError: vi.fn(),
    uploadFailureMessage: 'Attachment upload failed.',
    isLoading: false,
    isEditing: false,
    editMode: 'resend',
    editingMessageId: null,
    canSend: true,
    canQueueMessageBase: true,
    submissionState: {
      inputText: 'Hello',
      quotes: [],
      ttsContext: '',
      isFullscreen: false,
      clearCurrentDraft: vi.fn(),
      setInputText: vi.fn(),
      setQuotes: vi.fn(),
      setWaitingForUpload: vi.fn(),
      startSendAnimation: vi.fn(),
      stopSendAnimation: vi.fn(),
      exitFullscreen: vi.fn(),
      textareaRef: { current: textarea },
    },
    isNativeAudioModel: false,
    liveApi: {
      isConnected: false,
      connect: vi.fn(async () => true),
      sendText: vi.fn(async () => true),
      sendContent: vi.fn(async () => true),
    },
    onUpdateMessageContent: vi.fn(),
    setEditingMessageId: vi.fn(),
    onMessageSent: vi.fn(),
    onAddUserMessage: vi.fn(),
    onSendMessage: vi.fn(),
  } satisfies Parameters<typeof useChatInputSubmission>[0];
};

describe('useChatInputSubmission', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the send animation timer when the composer unmounts', () => {
    vi.useFakeTimers();
    const params = createSubmissionParams();
    const { result, unmount } = renderHook(() => useChatInputSubmission(params));

    act(() => {
      result.current.handleSubmit();
    });

    expect(params.submissionState.startSendAnimation).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(params.submissionState.stopSendAnimation).not.toHaveBeenCalled();
  });

  it('flushes the pending submission after the files finish processing (commit-time flush)', () => {
    const processingFile = createUploadedFile({
      id: 'file-uploading',
      isProcessing: true,
      uploadState: 'uploading',
    });
    const activeFile = createUploadedFile({
      id: 'file-uploading',
      isProcessing: false,
      uploadState: 'active',
    });

    const params = createSubmissionParams();
    params.selectedFiles = [processingFile];
    // Mirror the production invariant: the store selectedFiles is the same
    // reference as the render prop, so queuePendingSubmission sees the file as
    // still processing and defers instead of flushing immediately.
    useChatStore.setState({ selectedFiles: [processingFile] });

    const { result, rerender } = renderHook(() => useChatInputSubmission(params));

    act(() => {
      result.current.handleSubmit();
    });

    // The send is deferred while the file is still processing.
    expect(params.onSendMessage).not.toHaveBeenCalled();
    expect(params.submissionState.setWaitingForUpload).toHaveBeenCalledWith(true);

    // The upload completes: the store update drives a re-render with the active
    // file, and the effect flushes the pending submission with the latest text.
    useChatStore.setState({ selectedFiles: [activeFile] });
    params.selectedFiles = [activeFile];
    act(() => {
      rerender(() => useChatInputSubmission(params));
    });

    expect(params.onSendMessage).toHaveBeenCalledWith('Hello', expect.objectContaining({ isFastMode: false }));
    expect(params.submissionState.setWaitingForUpload).toHaveBeenCalledWith(false);

    useChatStore.setState({ selectedFiles: [] });
  });
});
