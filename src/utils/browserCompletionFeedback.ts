import { logService } from '@/services/logService';

type NotificationOptionsWithTag = NotificationOptions & {
  renotify?: boolean;
  tag?: string;
};

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const NOTE_E5_FREQUENCY = 659.25;
const NOTE_C5_FREQUENCY = 523.25;
const FIRST_NOTE_DURATION_S = 0.15;
const SECOND_NOTE_DURATION_S = 0.2;

export const showNotification = async (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window)) {
    logService.warn('This browser does not support desktop notification');
    return;
  }

  const show = () => {
    try {
      const notification = new Notification(title, {
        ...options,
        tag: 'amc-webui-response',
        renotify: true,
      } as NotificationOptionsWithTag);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => {
        notification.close();
      }, 7000);
    } catch (error) {
      logService.warn('Failed to create notification.', { error });
    }
  };

  if (Notification.permission === 'granted') {
    show();
  } else if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        show();
      }
    } catch (error) {
      logService.warn('Failed to request notification permission.', { error });
    }
  }
};

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }
  return sharedAudioContext;
};

export const playCompletionSound = async () => {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => undefined);
    }

    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime + startTime);
      oscillator.stop(audioContext.currentTime + startTime + duration);
    };

    playNote(NOTE_E5_FREQUENCY, 0, FIRST_NOTE_DURATION_S);
    playNote(NOTE_C5_FREQUENCY, FIRST_NOTE_DURATION_S, SECOND_NOTE_DURATION_S);
  } catch (error) {
    logService.error('Error playing completion sound', error);
  }
};
