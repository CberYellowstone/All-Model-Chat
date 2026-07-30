import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './cors.js';
import {
  JOB_ID_HEADER,
  finishJob,
  pumpUpstreamBodyIntoJob,
  maybeStreamWithSharedJob,
  type StreamJob,
} from './streamJobStore.js';

// Re-export the shared job-store primitives so existing callers
// (createServer, geminiProxy, tests) keep importing from a single module.
// thirdPartyProxy imports directly from streamJobStore instead.
export { abortJob, JOB_ID_HEADER, LAST_SEQ_HEADER } from './streamJobStore.js';

const isStreamPath = (pathname: string): boolean => pathname.includes(':streamGenerateContent');

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

  // Delegate the shared journal plumbing to streamJobStore: create the job if
  // missing, fire the Gemini-specific upstream fetch detached, then attach the
  // browser response to the buffered chunks. A browser disconnect only
  // unsubscribes (does NOT abort upstream), so a page refresh can resume.
  return maybeStreamWithSharedJob(request, response, { allowedOrigins: config.allowedOrigins }, (job) => {
    void runUpstream(job, request, upstreamUrl, apiKey, config.fetchImpl);
  });
}
