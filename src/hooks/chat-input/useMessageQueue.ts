import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { deferToNextTick } from '@/utils/deferToNextTick';
import type { UploadedFile } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import {
  areFilesStillProcessing,
  buildQueuedChatInputSubmission,
  getBlockingFileUploadFailure,
  type PendingChatInputSubmission,
  type QueuedChatInputSubmission,
  shouldFlushPendingSubmission,
} from '@/utils/chat-input/pendingSubmission';

type SetSelectedFiles = (files: UploadedFile[] | ((prevFiles: UploadedFile[]) => UploadedFile[])) => void;

interface UseMessageQueueParams {
  activeSessionId: string | null;
  modelId: string;
  inputText: string;
  quotes: string[];
  ttsContext?: string;
  selectedFiles: UploadedFile[];
  isLoading: boolean;
  canQueueMessageBase: boolean;
  clearCurrentDraft: () => void;
  setInputText: (value: string) => void;
  setQuotes: (quotes: string[]) => void;
  setWaitingForUpload: (isWaiting: boolean) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  setSelectedFiles: SetSelectedFiles;
  setAppFileError: (error: string | null) => void;
  uploadFailureMessage: string;
  completeEditSubmission: (messageId: string, content: string) => void;
  completeSendSubmission: (
    textToSend: string,
    isFastMode: boolean,
    options?: {
      files?: UploadedFile[];
      preserveComposer?: boolean;
    },
  ) => void;
}

export const useMessageQueue = ({
  activeSessionId,
  modelId,
  inputText,
  quotes,
  ttsContext,
  selectedFiles,
  isLoading,
  canQueueMessageBase,
  clearCurrentDraft,
  setInputText,
  setQuotes,
  setWaitingForUpload,
  textareaRef,
  setSelectedFiles,
  setAppFileError,
  uploadFailureMessage,
  completeEditSubmission,
  completeSendSubmission,
}: UseMessageQueueParams) => {
  const pendingSubmissionRef = useRef<PendingChatInputSubmission | null>(null);
  const [queuedSubmission, setQueuedSubmission] = useState<QueuedChatInputSubmission | null>(null);
  const flushingQueuedSubmissionRef = useRef<QueuedChatInputSubmission | null>(null);

  const canQueueMessage = canQueueMessageBase && !queuedSubmission;
  const activeQueuedSubmission =
    queuedSubmission && queuedSubmission.sessionId === activeSessionId ? queuedSubmission : null;

  const flushPendingSubmission = useCallback(
    (submission = pendingSubmissionRef.current) => {
      if (!submission) {
        return;
      }

      const blockingFileFailure = getBlockingFileUploadFailure(useChatStore.getState().selectedFiles);
      if (blockingFileFailure) {
        pendingSubmissionRef.current = null;
        setWaitingForUpload(false);
        setAppFileError(uploadFailureMessage);
        return;
      }

      pendingSubmissionRef.current = null;
      setWaitingForUpload(false);

      if (submission.kind === 'edit') {
        completeEditSubmission(submission.messageId, submission.content);
        return;
      }

      completeSendSubmission(submission.textToSend, submission.isFastMode);
    },
    [completeEditSubmission, completeSendSubmission, setAppFileError, setWaitingForUpload, uploadFailureMessage],
  );

  const removeQueuedSubmission = useCallback(() => {
    flushingQueuedSubmissionRef.current = null;
    setQueuedSubmission(null);
  }, []);

  const cancelPendingSubmission = useCallback(() => {
    pendingSubmissionRef.current = null;
    setWaitingForUpload(false);
  }, [setWaitingForUpload]);

  const restoreQueuedSubmission = useCallback(() => {
    if (!queuedSubmission) {
      return;
    }

    flushingQueuedSubmissionRef.current = null;
    setQueuedSubmission(null);
    setInputText(queuedSubmission.inputText);
    setQuotes(queuedSubmission.quotes);
    setSelectedFiles(queuedSubmission.files);
    deferToNextTick(() => textareaRef.current?.focus());
  }, [queuedSubmission, setInputText, setQuotes, setSelectedFiles, textareaRef]);

  const flushQueuedSubmission = useCallback(
    (submission = queuedSubmission) => {
      if (!submission) {
        return;
      }

      if (flushingQueuedSubmissionRef.current === submission) {
        return;
      }

      flushingQueuedSubmissionRef.current = submission;
      setQueuedSubmission((current) => (current === submission ? null : current));
      completeSendSubmission(submission.textToSend, submission.isFastMode, {
        files: submission.files.length > 0 ? submission.files : undefined,
        preserveComposer: true,
      });
    },
    [completeSendSubmission, queuedSubmission],
  );

  const queueCurrentSubmission = useCallback(() => {
    if (!canQueueMessage || !activeSessionId) {
      return;
    }

    const submission = buildQueuedChatInputSubmission({
      sessionId: activeSessionId,
      inputText,
      quotes,
      modelId,
      ttsContext,
      files: selectedFiles,
      isFastMode: false,
    });

    setQueuedSubmission(submission);
    flushingQueuedSubmissionRef.current = null;
    clearCurrentDraft();
    setInputText('');
    setQuotes([]);
    setSelectedFiles([]);
  }, [
    activeSessionId,
    canQueueMessage,
    clearCurrentDraft,
    inputText,
    modelId,
    quotes,
    selectedFiles,
    setInputText,
    setQuotes,
    setSelectedFiles,
    ttsContext,
  ]);

  const queuePendingSubmission = useCallback(
    (submission: PendingChatInputSubmission) => {
      pendingSubmissionRef.current = submission;
      setWaitingForUpload(true);

      if (!areFilesStillProcessing(useChatStore.getState().selectedFiles)) {
        flushPendingSubmission(submission);
      }
    },
    [flushPendingSubmission, setWaitingForUpload],
  );

  // Flush pending submissions after the commit, not from the store subscription
  // callback. The zustand subscriber fires synchronously on setState, before
  // React re-renders, so a flush triggered there would run on the previous
  // render's closure chain — handleSendMessage would still see the files as
  // isProcessing and block the send, silently dropping the text. Running from
  // this effect means the closures (incl. handleSendMessage's selectedFiles)
  // are all from the current render, where the files have finished processing.
  const previousSelectedFilesRef = useRef<UploadedFile[]>(selectedFiles);

  useEffect(() => {
    const previousFiles = previousSelectedFilesRef.current;

    if (
      shouldFlushPendingSubmission({
        pendingSubmission: pendingSubmissionRef.current,
        previousFiles,
        currentFiles: selectedFiles,
      })
    ) {
      flushPendingSubmission();
    }

    previousSelectedFilesRef.current = selectedFiles;
  }, [selectedFiles, flushPendingSubmission]);

  useEffect(() => {
    if (activeQueuedSubmission && !isLoading && flushingQueuedSubmissionRef.current !== activeQueuedSubmission) {
      flushQueuedSubmission(activeQueuedSubmission);
    }
  }, [activeQueuedSubmission, flushQueuedSubmission, isLoading]);

  return {
    canQueueMessage,
    activeQueuedSubmission,
    queueCurrentSubmission,
    queuePendingSubmission,
    cancelPendingSubmission,
    restoreQueuedSubmission,
    removeQueuedSubmission,
  };
};
