import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/chat-input/focus', () => ({ focusChatInput: vi.fn() }));
vi.mock('@/utils/model/modelSwitchSettings', () => ({
  resolveModelSwitchSettings: vi.fn(({ targetModelId }: { targetModelId: string }) => ({
    modelId: targetModelId,
    thinkingBudget: 0,
    thinkingLevel: 'MEDIUM',
  })),
}));

import { useModelSelection } from './useModelSelection';
import { createAppSettings, createChatSettings, createSavedChatSession } from '@/test/data/factories';
import { renderHook } from '@/test/render/renderer';
import { GEMINI_PROVIDER_ID } from '@/types';

describe('useModelSelection', () => {
  it('clears third-party session routing when selecting a Gemini model', () => {
    const thirdPartySettings = createChatSettings({
      modelId: 'kimi-k3',
      providerId: 'kimi',
    });
    const updateAndPersistSessions = vi.fn();

    const { result, unmount } = renderHook(() =>
      useModelSelection({
        appSettings: createAppSettings(),
        activeSessionId: 'session-1',
        currentChatSettings: thirdPartySettings,
        isLoading: false,
        updateAndPersistSessions,
        setActiveSessionId: vi.fn(),
        setCurrentChatSettings: vi.fn(),
        setIsSwitchingModel: vi.fn(),
        handleStopGenerating: vi.fn(),
        userScrolledUpRef: { current: false },
      }),
    );

    act(() => {
      result.current.handleSelectModelInHeader('gemini-3-flash-preview');
    });

    const update = updateAndPersistSessions.mock.calls[0]?.[0];
    const [updatedSession] = update([createSavedChatSession({ id: 'session-1', settings: thirdPartySettings })]);

    expect(updatedSession.settings).toMatchObject({
      modelId: 'gemini-3-flash-preview',
      providerId: GEMINI_PROVIDER_ID,
    });

    unmount();
  });
});
