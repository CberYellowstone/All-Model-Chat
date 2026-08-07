import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAT_INPUT_TEXTAREA_SELECTOR } from '@/constants/layout';
import { focusChatInput } from './focus';

describe('focusChatInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('focuses the chat input textarea after the delay', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-chat-input-textarea', 'true');
    document.body.appendChild(textarea);
    const focusSpy = vi.spyOn(textarea, 'focus');

    focusChatInput(0);
    vi.runOnlyPendingTimers();

    expect(document.querySelector(CHAT_INPUT_TEXTAREA_SELECTOR)).toBe(textarea);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('places the caret at the end of the value when requested', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-chat-input-textarea', 'true');
    textarea.value = '请使用 Live Artifacts\n';
    document.body.appendChild(textarea);
    const selectionSpy = vi.spyOn(textarea, 'setSelectionRange');

    focusChatInput(0, { caret: 'end' });
    vi.runOnlyPendingTimers();

    expect(selectionSpy).toHaveBeenCalledWith(textarea.value.length, textarea.value.length);
    expect(textarea.scrollTop).toBe(textarea.scrollHeight);
  });

  it('ignores delayed focus after the document has been torn down', () => {
    const originalDocument = document;
    focusChatInput(0);
    vi.stubGlobal('document', undefined);

    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
    vi.stubGlobal('document', originalDocument);
  });

  it('does not steal focus while the user is editing inside the history sidebar', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-chat-input-textarea', 'true');
    document.body.appendChild(textarea);

    const sidebar = document.createElement('div');
    sidebar.setAttribute('data-history-sidebar-root', 'true');
    const renameInput = document.createElement('input');
    sidebar.appendChild(renameInput);
    document.body.appendChild(sidebar);
    renameInput.focus();

    const focusSpy = vi.spyOn(textarea, 'focus');

    focusChatInput(0);
    vi.runOnlyPendingTimers();

    expect(focusSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(renameInput);
  });

  it('still focuses the chat input when focus is outside the sidebar', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-chat-input-textarea', 'true');
    document.body.appendChild(textarea);

    const outsideInput = document.createElement('input');
    document.body.appendChild(outsideInput);
    outsideInput.focus();

    const focusSpy = vi.spyOn(textarea, 'focus');

    focusChatInput(0);
    vi.runOnlyPendingTimers();

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
