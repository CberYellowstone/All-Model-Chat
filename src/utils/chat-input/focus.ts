import { CHAT_INPUT_TEXTAREA_SELECTOR, HISTORY_SIDEBAR_ROOT_SELECTOR } from '@/constants/layout';

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

    // 聊天输入框由“选中/新建会话”的异步流程延迟聚焦。若此刻焦点仍在侧边栏
    //（如用户正双击标题重命名会话），不要抢走它 —— 否则会触发重命名输入框的
    // onBlur 确认，导致编辑框闪一下就消失。
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(HISTORY_SIDEBAR_ROOT_SELECTOR)) {
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
