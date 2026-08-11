import { useState, useRef, useEffect } from 'react';
import { releaseManagedObjectUrl } from '@/services/objectUrlManager';

export const useSelectionAudio = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoadingState] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      releaseManagedObjectUrl(audioUrl);
    };
  }, [audioUrl]);

  const setIsLoading = (loading: boolean) => {
    if (loading) {
      setErrorMessage(null);
    }
    setIsLoadingState(loading);
  };

  const play = (url: string) => {
    setAudioUrl(url);
    setIsPlaying(true);
    setErrorMessage(null);
  };

  const stop = () => {
    setIsPlaying(false);
    setAudioUrl(null);
  };

  const fail = (message: string) => {
    setIsPlaying(false);
    setIsLoadingState(false);
    setErrorMessage(message);
  };

  return {
    isPlaying,
    isLoading,
    audioUrl,
    errorMessage,
    setIsLoading,
    play,
    stop,
    fail,
    audioRef,
  };
};
