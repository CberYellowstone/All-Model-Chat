import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { getCorsHeaders, sendJson } from './cors.js';

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

const getJob = (id: string): StreamJob | undefined => jobs.get(id);

const createJob = (id: string): StreamJob => {
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

const appendChunk = (job: StreamJob, data: string): void => {
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
      // Normalize CRLF/CR line endings to LF FIRST so \n\n splitting works
      // for upstreams that send \r\n\r\n events (e.g. aistudio-to-api).
      buffer += bytes.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx + 2);
        buffer = buffer.slice(idx + 2);
        if (rawEvent.trim()) {
          appendChunk(job, rawEvent);
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
function flushToResponse(job: StreamJob, response: ServerResponse, cursor: number): number {
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

// ── Shared SSE attach helper ─────────────────────────────────────────────────

interface AttachJobStreamConfig {
  allowedOrigins: string[];
}

/**
 * Helper for a provider proxy that wants the full journal treatment: detect
 * the job-id header, create the job if missing, fire the (provider-specific)
 * upstream fetch detached from the browser connection, then attach the browser
 * response to the buffered job. Returns true when handled, false when the
 * request had no job-id header (caller falls through to pass-through).
 *
 * `startUpstream` receives the job and must begin the detached upstream fetch
 * (the provider supplies the URL, headers, abort signal wiring, and fetch impl).
 * It is only invoked for a brand-new job.
 */
export async function maybeStreamWithSharedJob(
  request: IncomingMessage,
  response: ServerResponse,
  config: AttachJobStreamConfig,
  startUpstream: (job: StreamJob) => void,
): Promise<boolean> {
  const jobIdRaw = request.headers[JOB_ID_HEADER];
  const jobId = (Array.isArray(jobIdRaw) ? jobIdRaw[0] : jobIdRaw)?.trim();
  if (!jobId) {
    return false;
  }

  let job = getJob(jobId);
  if (!job) {
    job = createJob(jobId);
    // Fire the upstream fetch detached from the browser connection so that a
    // browser disconnect does not cancel the upstream. The fetch reads the
    // request body lazily; if the browser never sent a body (e.g. an abort
    // probe) the upstream fetch will fail fast and finish the job.
    startUpstream(job);
  }

  return attachJobStream(request, response, config, job);
}

/**
 * Attach a browser SSE response to an existing job and fan out the buffered
 * chunks. Provider-agnostic. The caller must have already created the job and
 * (for a new job) started the upstream fetch; this function only manages the
 * browser-side subscription. Returns true when handled.
 */
async function attachJobStream(
  request: IncomingMessage,
  response: ServerResponse,
  config: AttachJobStreamConfig,
  job: StreamJob,
): Promise<boolean> {
  const lastSeqHeader = request.headers[LAST_SEQ_HEADER];
  const lastSeqRaw = Array.isArray(lastSeqHeader) ? lastSeqHeader[0] : lastSeqHeader;
  const lastSeq = Number(lastSeqRaw ?? 0) || 0;

  // Terminal-job short-circuit: if the upstream already finished with an error
  // (e.g. a 429/500 at the start, or a mid-stream failure that completed the
  // job before this request attached), surface it as a 502 with the real cause
  // so the client routes through its error handler and the user sees the actual
  // reason — instead of an HTTP 200 with an empty body that looks like the
  // model simply returned nothing. Must run before writeHead(200) commits the
  // SSE headers, after which the status can no longer change.
  if (job.done && job.error) {
    sendJson(request, response, 502, { error: job.error }, config.allowedOrigins);
    return true;
  }

  response.writeHead(200, {
    ...getCorsHeaders(request, config.allowedOrigins),
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
  });

  let cursor = lastSeq;

  const flush = () => {
    if (response.writableEnded || response.destroyed) {
      return;
    }
    cursor = flushToResponse(job, response, cursor);
    if (job?.done) {
      job.listeners.delete(flush);
      // If the upstream finished with an error after we already started
      // streaming, we can no longer change the 200 status; destroy the socket
      // so the client detects the broken stream and routes to its error handler
      // with the real cause rather than ending cleanly as if the model replied
      // with nothing.
      if (job.error) {
        console.error('[stream-jobs] upstream finished with error after headers sent:', job.error);
        response.destroy(new Error(job.error));
        return;
      }
      response.end();
    }
  };

  // Drain anything already buffered (covers the resume case where the job
  // already has history, and the just-started case where the first events
  // landed before this listener attached).
  flush();
  if (job && !job.done) {
    job.listeners.add(flush);
    // Key difference vs. the normal proxy: a browser disconnect here only
    // unsubscribes. The upstream keeps running so a refresh can resume.
    response.on('close', () => {
      job?.listeners.delete(flush);
    });
  }

  return true;
}
