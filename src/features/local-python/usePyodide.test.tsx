import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunPython } = vi.hoisted(() => ({
  mockRunPython: vi.fn(
    async (): Promise<{
      output: string;
      image: undefined;
      files: never[];
      result: string | undefined;
      status: 'success';
    }> => ({
      output: 'ok',
      image: undefined,
      files: [],
      result: undefined,
      status: 'success',
    }),
  ),
}));

vi.mock('./pyodideService', () => ({
  pyodideService: {
    runPython: mockRunPython,
  },
}));

import { clearPyodideResultCache, usePyodide } from './usePyodide';
import { renderHook } from '@/test/render/renderer';

describe('usePyodide', () => {
  beforeEach(() => {
    mockRunPython.mockClear();
    mockRunPython.mockResolvedValue({
      output: 'ok',
      image: undefined,
      files: [],
      result: undefined,
      status: 'success',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not persist execution state across remounts when no explicit cache key is provided', async () => {
    const first = renderHook(() => usePyodide(), { attachToDocument: true });

    await act(async () => {
      await first.result.current.runCode('print("hello")');
    });

    expect(first.result.current.hasRun).toBe(true);
    first.unmount();

    const second = renderHook(() => usePyodide(), { attachToDocument: true });
    expect(second.result.current.hasRun).toBe(false);
    expect(second.result.current.output).toBeNull();
    second.unmount();
  });

  it('restores execution state across remounts when an explicit cache key is provided', async () => {
    const first = renderHook(() => usePyodide('message-1:block-3'), { attachToDocument: true });

    await act(async () => {
      await first.result.current.runCode('print("hello")');
    });

    expect(first.result.current.hasRun).toBe(true);
    first.unmount();

    const second = renderHook(() => usePyodide('message-1:block-3'), { attachToDocument: true });
    expect(second.result.current.hasRun).toBe(true);
    expect(second.result.current.output).toBe('ok');
    second.unmount();
  });

  it('evicts the least-recently-used cached result once the cap is reached', async () => {
    clearPyodideResultCache();

    // The cache holds a bounded number of entries; producing more distinct keys
    // than the limit must evict the oldest instead of growing unboundedly.
    const MANY = 30;
    for (let index = 0; index < MANY; index += 1) {
      mockRunPython.mockResolvedValueOnce({
        output: `out-${index}`,
        image: undefined,
        files: [],
        result: undefined,
        status: 'success',
      });
      const key = `msg-1:block-${index}`;
      const hook = renderHook(() => usePyodide(key), { attachToDocument: true });
      await act(async () => {
        await hook.result.current.runCode('print(1)');
      });
      hook.unmount();
    }

    // The first key (oldest, never re-read) should have been evicted...
    const evicted = renderHook(() => usePyodide('msg-1:block-0'), { attachToDocument: true });
    expect(evicted.result.current.hasRun).toBe(false);
    evicted.unmount();

    // ...while a recent key (within the cap) is still restored.
    const recent = renderHook(() => usePyodide('msg-1:block-29'), { attachToDocument: true });
    expect(recent.result.current.hasRun).toBe(true);
    expect(recent.result.current.output).toBe('out-29');
    recent.unmount();

    clearPyodideResultCache();
  });

  it('clearPyodideResultCache drops every cached entry', async () => {
    const first = renderHook(() => usePyodide('msg-1:block-1'), { attachToDocument: true });
    await act(async () => {
      await first.result.current.runCode('print(1)');
    });
    first.unmount();

    clearPyodideResultCache();

    const after = renderHook(() => usePyodide('msg-1:block-1'), { attachToDocument: true });
    expect(after.result.current.hasRun).toBe(false);
    after.unmount();
  });

  it('does not surface the raw expression result as user-visible output', async () => {
    mockRunPython.mockResolvedValueOnce({
      output: '',
      image: undefined,
      files: [],
      result: '42',
      status: 'success',
    });

    const hook = renderHook(() => usePyodide('msg-1:result'), { attachToDocument: true });
    await act(async () => {
      await hook.result.current.runCode('40 + 2');
    });

    // The last-expression value ('42') is for the AI tool response only; the
    // user sees stdout, which is empty here, so the fallback message shows.
    expect(hook.result.current.output).toBe('No output');
    hook.unmount();
  });
});
