import { CHAT_INPUT_TEXTAREA_SELECTOR } from '@/constants/layout';

type FocusChatInputOptions = {
  /** Place the caret at the end of the current input value after focusing. */
  caret?: 'end';
};

const placeCaretAtEnd = (textarea: HTMLTextAreaElement) => {
  const textLength = textarea.value.length;
  textarea.setSelectionRange(textLength, textLength);
  textarea.scrollTop = textarea.scrollHeight;
};

export const focusChatInput = (delayMs = 50, options?: FocusChatInputOptions) => {
  setTimeout(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const textarea = document.querySelector<HTMLTextAreaElement>(CHAT_INPUT_TEXTAREA_SELECTOR);
    if (!textarea) {
      return;
    }

    textarea.focus();
    if (options?.caret === 'end') {
      placeCaretAtEnd(textarea);
    }
  }, delayMs);
};
