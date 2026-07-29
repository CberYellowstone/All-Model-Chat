import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GENERATION_LEASE_TTL_MS,
  isGenerationLeaseHeldByOther,
  readGenerationLease,
  releaseGenerationLease,
  renewGenerationLease,
  tryAcquireGenerationLease,
} from './generationLease';
import { TAB_ID } from '@/stores/tabIdentity';

describe('generationLease', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('acquires a lease for the current tab', () => {
    expect(tryAcquireGenerationLease('session-a', 'gen-1')).toBe(true);
    expect(readGenerationLease('session-a')).toEqual({
      tabId: TAB_ID,
      generationId: 'gen-1',
      ts: expect.any(Number),
    });
    expect(isGenerationLeaseHeldByOther('session-a')).toBe(false);
  });

  it('rejects acquire when another tab holds a fresh lease', () => {
    localStorage.setItem(
      'amc_generation_lease_v1:session-a',
      JSON.stringify({ tabId: 'other-tab', generationId: 'gen-x', ts: Date.now() }),
    );

    expect(tryAcquireGenerationLease('session-a', 'gen-2')).toBe(false);
    expect(isGenerationLeaseHeldByOther('session-a')).toBe(true);
  });

  it('allows re-acquire by the same tab', () => {
    expect(tryAcquireGenerationLease('session-a', 'gen-1')).toBe(true);
    expect(tryAcquireGenerationLease('session-a', 'gen-2')).toBe(true);
    expect(readGenerationLease('session-a')?.generationId).toBe('gen-2');
  });

  it('treats expired leases as free', () => {
    localStorage.setItem(
      'amc_generation_lease_v1:session-a',
      JSON.stringify({ tabId: 'other-tab', generationId: 'gen-x', ts: Date.now() - GENERATION_LEASE_TTL_MS - 1 }),
    );

    expect(isGenerationLeaseHeldByOther('session-a')).toBe(false);
    expect(tryAcquireGenerationLease('session-a', 'gen-1')).toBe(true);
  });

  it('renews only when this tab owns the lease', () => {
    tryAcquireGenerationLease('session-a', 'gen-1');
    const firstTs = readGenerationLease('session-a')!.ts;
    vi.advanceTimersByTime(1000);
    expect(renewGenerationLease('session-a', 'gen-1')).toBe(true);
    expect(readGenerationLease('session-a')!.ts).toBeGreaterThan(firstTs);

    localStorage.setItem(
      'amc_generation_lease_v1:session-b',
      JSON.stringify({ tabId: 'other-tab', generationId: 'gen-x', ts: Date.now() }),
    );
    expect(renewGenerationLease('session-b', 'gen-x')).toBe(false);
  });

  it('releases only the current tab lease', () => {
    tryAcquireGenerationLease('session-a', 'gen-1');
    releaseGenerationLease('session-a', 'gen-1');
    expect(readGenerationLease('session-a')).toBeNull();

    localStorage.setItem(
      'amc_generation_lease_v1:session-b',
      JSON.stringify({ tabId: 'other-tab', generationId: 'gen-x', ts: Date.now() }),
    );
    releaseGenerationLease('session-b');
    expect(readGenerationLease('session-b')?.tabId).toBe('other-tab');
  });
});
