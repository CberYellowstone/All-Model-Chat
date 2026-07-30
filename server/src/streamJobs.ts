import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCorsHeaders, sendJson } from './cors.js';
import {
  JOB_ID_HEADER,
  LAST_SEQ_HEADER,
  getJob,
  createJob,
  finishJob,
  pumpUpstreamBodyIntoJob,
  flushToResponse,
  type StreamJob,
} from './streamJobStore.js';

// Re-export the shared job-store primitives so existing callers
// (createServer, geminiProxy, tests) keep importing from a single module.
// thirdPartyProxy imports directly from streamJobStore instead.
export { abortJob } from './streamJobStore.js';

const isStreamPath = (pathname: string): boolean => pathname.includes(':streamGenerateContent');

export { JOB_ID_HEADER, LAST_SEQ_HEADER } from './streamJobStore.js';

// ── Gemini-specific header builders ─────────────────────────────────────────

interface GeminiStreamProxyConfig {
  geminiApiBase: string;
  geminiApiKey?: string;
  allowedOrigins: string[];
  serverKeyPriority?: boolean;
  fetchImpl: typeof fetch;
}

interface RequestLike {
  method?: string;
  headers: IncomingMessage['headers'];
  url?: string;
}

// Resolve the upstream API key with the same BYOK 兜底 semantics as the regular
// proxy: a real browser key wins; the server key is the fallback.
function resolveRequestApiKey(request: RequestLike, serverApiKey?: string, serverKeyPriority = false): string {
  const trimmedServerApiKey = serverApiKey?.trim();
  const browserApiKeyHeader = request.headers['x-goog-api-key'];
  const browserApiKey = Array.isArray(browserApiKeyHeader)
    ? (browserApiKeyHeader[0]?.trim() ?? '')
    : (browserApiKeyHeader?.trim() ?? '');

  if (serverKeyPriority && trimmedServerApiKey) {
    return trimmedServerApiKey;
  }
  if (browserApiKey) {
    return browserApiKey;
  }
  return trimmedServerApiKey ?? '';
}

// Mirrors buildProxyHeaders in geminiProxy.ts, but standalone so this module
// stays self-contained. Strips hop-by-hop + connection-managed + sensitive
// headers, then stamps the resolved key.
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
const STRIPPED_PROXY_REQUEST_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  'accept-encoding',
  'authorization',
  'content-length',
  'cookie',
  'host',
  'x-gemini-upstream-base-url',
]);

function getConnectionManagedHeaderSet(value: string | null | undefined): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .split(',')
      .map((headerName) => headerName.trim().toLowerCase())
      .filter((headerName) => headerName.length > 0),
  );
}

function buildProxyHeaders(request: IncomingMessage, apiKey: string): Headers {
  const headers = new Headers();
  const connectionManagedHeaders = getConnectionManagedHeaderSet(
    Array.isArray(request.headers.connection) ? request.headers.connection.join(',') : request.headers.connection,
  );

  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'undefined') {
      continue;
    }
    const normalizedName = name.toLowerCase();
    if (STRIPPED_PROXY_REQUEST_HEADERS.has(normalizedName) || connectionManagedHeaders.has(normalizedName)) {
      continue;
    }
    if (Array.isArray(value)) {
      headers.set(normalizedName, value.join(','));
      continue;
    }
    headers.set(normalizedName, value);
  }

  headers.set('x-goog-api-key', apiKey);
  return headers;
}

// ── Gemini-specific upstream runner ─────────────────────────────────────────

async function runUpstream(
  job: StreamJob,
  request: IncomingMessage,
  upstreamUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    const hasBody = !['GET', 'HEAD'].includes(request.method || 'POST');
    const requestInit: RequestInit & { duplex?: 'half' } = {
      method: request.method || 'POST',
      headers: buildProxyHeaders(request, apiKey),
      signal: job.abortController.signal,
      // redirect: 'manual' so a public GEMINI_API_BASE cannot 302 into a
      // private network host after the input URL passed validation.
      redirect: 'manual',
    };
    if (hasBody) {
      requestInit.body = request as unknown as BodyInit;
      requestInit.duplex = 'half';
    }

    const upstreamResponse = await fetchImpl(upstreamUrl, requestInit);

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      finishJob(job, `upstream ${upstreamResponse.status}`);
      return;
    }

    await pumpUpstreamBodyIntoJob(job, upstreamResponse);
  } catch (error) {
    if (job.abortController.signal.aborted) {
      // Aborted by client (stream-abort endpoint); already finished with that
      // reason. Don't overwrite the abort error.
      return;
    }
    finishJob(job, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handles a streaming Gemini request with job journaling. If no `x-amc-job-id`
 * header is present, this returns false and the caller should fall back to the
 * ordinary pass-through proxy. When the header is present, the upstream is
 * fetched and buffered independently of the browser connection: a browser
 * disconnect only unsubscribes (does NOT abort upstream), so a page refresh can
 * resume from the last seq the browser saw.
 */
export async function maybeStreamWithJob(
  request: IncomingMessage,
  response: ServerResponse,
  upstreamPath: string,
  upstreamUrl: string,
  config: GeminiStreamProxyConfig,
): Promise<boolean> {
  if (!isStreamPath(upstreamPath)) {
    return false;
  }
  const jobIdRaw = request.headers[JOB_ID_HEADER];
  const jobId = (Array.isArray(jobIdRaw) ? jobIdRaw[0] : jobIdRaw)?.trim();
  if (!jobId) {
    return false;
  }

  const apiKey = resolveRequestApiKey(request, config.geminiApiKey, config.serverKeyPriority);
  if (!apiKey) {
    sendJson(request, response, 500, { error: 'GEMINI_API_KEY is not configured.' }, config.allowedOrigins);
    return true;
  }

  let job = getJob(jobId);
  if (!job) {
    job = createJob(jobId);
    // Fire the upstream fetch detached from the browser connection so that a
    // browser disconnect does not cancel the upstream. The fetch reads the
    // request body lazily; if the browser never sent a body (e.g. an abort
    // probe) the upstream fetch will fail fast and finish the job.
    void runUpstream(job, request, upstreamUrl, apiKey, config.fetchImpl);
  }

  const lastSeqHeader = request.headers[LAST_SEQ_HEADER];
  const lastSeqRaw = Array.isArray(lastSeqHeader) ? lastSeqHeader[0] : lastSeqHeader;
  const lastSeq = Number(lastSeqRaw ?? 0) || 0;

  // Terminal-job short-circuit: if the upstream already finished with an error
  // (e.g. a 429/500 at the start, or a mid-stream failure that completed the
  // job before this request attached), surface it as a 502 with the real cause
  // so the SDK routes through streamOnError and the user sees the actual
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
    cursor = flushToResponse(job as StreamJob, response, cursor);
    if (job?.done) {
      job.listeners.delete(flush);
      // If the upstream finished with an error after we already started
      // streaming, we can no longer change the 200 status; destroy the socket
      // so the SDK detects the broken stream and routes to streamOnError with
      // the real cause rather than ending cleanly as if the model replied with
      // nothing.
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
