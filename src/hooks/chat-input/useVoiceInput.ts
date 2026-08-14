import { logService } from '@/services/logService';
import { type Dispatch, type RefObject, type SetStateAction, useState, useCallback } from 'react';
import { prepareAudioForGeminiTranscription } from '@/features/audio/audioCompression';
import { useRecorder } from '@/hooks/core/useRecorder';
import { useTextAreaInsert } from '@/hooks/useTextAreaInsert';
import { useI18n } from '@/contexts/I18nContext';

interface UseVoiceInputProps {
  onTranscribeAudio: (file: File) => Promise<string | null>;
  setInputText: Dispatch<SetStateAction<string>>;
  setAppFileError?: (error: string | null) => void;
  /** @deprecated Voice input always converts to a Gemini-supported format; kept for call-site compatibility. */
  isAudioCompressionEnabled?: boolean;
  isSystemAudioRecordingEnabled?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
}

export const useVoiceInput = ({
  onTranscribeAudio,
  setInputText,
  setAppFileError,
  textareaRef,
}: UseVoiceInputProps) => {
  const { t } = useI18n();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemAudioWarning, setSystemAudioWarning] = useState<string | null>(null);
  const insertText = useTextAreaInsert(textareaRef, setInputText);

  const reportError = useCallback(
    (message: string | null) => {
      setError(message);
      setAppFileError?.(message);
    },
    [setAppFileError],
  );

  const reportSystemAudioWarning = useCallback(
    (warning: string | null) => {
      setSystemAudioWarning(warning);
      setAppFileError?.(warning);
    },
    [setAppFileError],
  );

  const handleRecordingComplete = useCallback(
    async (audioBlob: Blob) => {
      if (audioBlob.size > 0) {
        setIsTranscribing(true);
        try {
          // Browser MediaRecorder often yields audio/webm;codecs=opus, which Gemini rejects.
          // Always convert first — independent of the user "audio compression" setting.
          const fileToTranscribe = await prepareAudioForGeminiTranscription(audioBlob);
          const transcribedText = await onTranscribeAudio(fileToTranscribe);

          if (transcribedText) {
            insertText(transcribedText.trim(), { ensurePadding: true });
          }
        } catch (error) {
          logService.error('Error processing/transcribing audio:', error);
          const message = error instanceof Error ? error.message : t('voiceInputFailed');
          reportError(t('voiceInputFailedWithMessage').replace('{message}', message));
        } finally {
          setIsTranscribing(false);
          setIsFinalizingRecording(false);
        }
      } else {
        setIsFinalizingRecording(false);
      }
    },
    [onTranscribeAudio, insertText, reportError, t],
  );

  const { status, isInitializing, startRecording, stopRecording, cancelRecording } = useRecorder({
    onStop: handleRecordingComplete,
    onError: reportError,
    onSystemAudioWarning: reportSystemAudioWarning,
    permissionErrorMessage: t('voiceInputPermissionError'),
  });

  const isRecording = status === 'recording';
  const isBusy = isTranscribing || isFinalizingRecording;

  const handleVoiceInputClick = () => {
    if (isRecording) {
      setIsFinalizingRecording(true);
      stopRecording();
    } else {
      reportError(null);
      reportSystemAudioWarning(null);
      startRecording({ captureSystemAudio: false });
    }
  };

  const handleCancelRecording = () => {
    setIsFinalizingRecording(false);
    reportSystemAudioWarning(null);
    cancelRecording();
  };

  return {
    isRecording,
    isTranscribing: isBusy,
    isMicInitializing: isInitializing,
    error,
    systemAudioWarning,
    handleVoiceInputClick,
    handleCancelRecording,
  };
};
