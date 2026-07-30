import type { ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

// Request headers that gate stream journaling. Exported so every provider's
// proxy (Gemini, OpenAI-compatible, Anthropic) and the unified abort route
// share the exact same header names.
export const JOB_ID_HEADER = 'x-amc-job-id';
export const LAST_SEQ_HEADER = 'x-amc-last-seq';

// ── Job data structures ─────────────────────────────────────────────────────

export interface StreamJobChunk {
  seq: number;
  data: string;
}

export interface StreamJob {
  id: string;
  firstSeq: number;
  chunks: StreamJobChunk[];
  done: boolean;
  error?: string;
  abortController: AbortController;
  listeners: Set<() => void>;
  createdAt: number;
  updatedAt: number;
  bufferedBytes: number;
}

// ── Tuning constants ────────────────────────────────────────────────────────

const JOB_TTL_MS = 10 * 60_000; // completed jobs retained for 10 min
const JOB_HARD_LIMIT_MS = 60 * 60_000; // hard cap 60 min even while in flight
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const MAX_DROP_RATIO = 0.25;

// ── Shared job store ────────────────────────────────────────────────────────

const jobs = new Map<string, StreamJob>();

// Periodically evict expired jobs. unref() so the timer never keeps the process
// alive on its own (the HTTP server owns lifetime).
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const expired = job.done && now - job.updatedAt > JOB_TTL_MS;
    const tooOld = now - job.createdAt > JOB_HARD_LIMIT_MS;
    if (expired || tooOld) {
      // If a job is still in flight past the hard limit, abort the upstream so
      // it cannot leak forever behind an orphaned listener.
      if (!job.done) {
        try {
          job.abortController.abort();
        } catch {
          /* ignore */
        }
      }
      jobs.delete(id);
    }
  }
}, 60_000);
sweeper.unref();

// ── CRUD ────────────────────────────────────────────────────────────────────

export const getJob = (id: string): StreamJob | undefined => jobs.get(id);

export const createJob = (id: string): StreamJob => {
  const job: StreamJob = {
    id,
    firstSeq: 1,
    chunks: [],
    done: false,
    abortController: new AbortController(),
    listeners: new Set(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    bufferedBytes: 0,
  };
  jobs.set(id, job);
  return job;
};

export const appendChunk = (job: StreamJob, data: string): void => {
  const seq = job.firstSeq + job.chunks.length;
  job.chunks.push({ seq, data });
  job.updatedAt = Date.now();
  job.bufferedBytes += data.length;

  // Bounded buffer: drop the oldest chunk bucket so a runaway stream cannot
  // exhaust memory. Resume callers can only rejoin the tail after a drop.
  if (job.bufferedBytes > MAX_BUFFER_BYTES) {
    const drop = Math.max(1, Math.ceil(job.chunks.length * MAX_DROP_RATIO));
    const removed = job.chunks.splice(0, drop);
    job.firstSeq += removed.length;
    job.bufferedBytes = job.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
  }

  for (const notify of job.listeners) {
    try {
      notify();
    } catch {
      /* a listener throwing must not break the producer */
    }
  }
};

export const finishJob = (job: StreamJob, error?: string): void => {
  if (job.done) {
    return;
  }
  job.done = true;
  if (error) {
    job.error = error;
  }
  job.updatedAt = Date.now();
  const listeners = job.listeners;
  job.listeners = new Set();
  for (const notify of listeners) {
    try {
      notify();
    } catch {
      /* ignore */
    }
  }
};

/**
 * Abort a job by id. Returns true if the job was aborted, false if not found
 * or already done. Works for any provider's job in the shared Map.
 */
export const abortJob = (id: string): boolean => {
  const job = jobs.get(id);
  if (!job || job.done) {
    return false;
  }
  try {
    job.abortController.abort();
  } catch {
    /* ignore */
  }
  finishJob(job, 'aborted by client');
  return true;
};

// ── Generic SSE helpers (provider-agnostic) ─────────────────────────────────

/**
 * Append the raw upstream body to the job's chunk buffer, splitting on SSE
 * event boundaries (\n\n) so each chunk maps to one complete SSE event. This
 * keeps resume precise: a reconnect resumes at the exact next event boundary.
 *
 * Works for any SSE-based stream (Gemini, OpenAI-compatible, Anthropic).
 */
export function pumpUpstreamBodyIntoJob(job: StreamJob, upstreamResponse: Response): Promise<void> {
  return (async () => {
    let buffer = '';
    for await (const bytes of Readable.fromWeb(upstreamResponse.body as unknown as NodeReadableStream)) {
      buffer += bytes.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx + 2);
        buffer = buffer.slice(idx + 2);
        if (rawEvent.trim()) {
          appendChunk(job, rawEvent.replace(/\r\n/g, '\n'));
        }
      }
    }
    if (buffer.trim()) {
      appendChunk(job, buffer);
    }
    finishJob(job);
  })().catch((error: unknown) => {
    finishJob(job, error instanceof Error ? error.message : String(error));
  });
}

/**
 * Fan out the buffered chunks to the browser response, from `cursor + 1`
 * onward. Each call drains everything currently buffered. When the job is
 * done, the response is closed. Returns the new cursor.
 */
export function flushToResponse(job: StreamJob, response: ServerResponse, cursor: number): number {
  let nextCursor = cursor;
  for (const chunk of job.chunks) {
    if (chunk.seq > nextCursor && chunk.seq >= job.firstSeq) {
      if (!response.write(chunk.data)) {
        // Backpressure: Node will emit 'drain'; we just stop here and let the
        // next listener tick push more. Avoid advancing past an unwritten seq.
        break;
      }
      nextCursor = chunk.seq;
    }
  }
  return nextCursor;
}
