import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { getCorsHeaders, sendJson } from './cors.js';
import { maybeStreamWithJob } from './streamJobs.js';
import { isPrivateNetworkHostname } from '../../shared/privateNetwork.js';
import {
  STRIPPED_PROXY_RESPONSE_HEADERS,
  copyProxyRequestHeaders,
  getConnectionManagedHeaders,
} from './proxyHeaders.js';

export const GEMINI_PROXY_PREFIX = '/api/gemini';
const GEMINI_UPSTREAM_BASE_HEADER = 'x-gemini-upstream-base-url';

const STRIPPED_PROXY_REQUEST_HEADERS = new Set([
  'accept-encoding',
  'authorization',
  'content-length',
  'cookie',
  'host',
  'x-gemini-upstream-base-url',
]);

export interface GeminiProxyConfig {
  geminiApiBase: string;
  geminiApiKey?: string;
  allowedOrigins: string[];
  // When false (default): a browser-supplied x-goog-api-key wins, the server
  // key is the fallback (BYOK 兜底). When true: the server key wins.
  serverKeyPriority?: boolean;
}

function resolveRequestApiKey(request: IncomingMessage, serverApiKey?: string, serverKeyPriority = false): string {
  const trimmedServerApiKey = serverApiKey?.trim();
  const browserApiKeyHeader = request.headers['x-goog-api-key'];
  const browserApiKey = Array.isArray(browserApiKeyHeader)
    ? (browserApiKeyHeader[0]?.trim() ?? '')
    : (browserApiKeyHeader?.trim() ?? '');

  if (serverKeyPriority && trimmedServerApiKey) {
    return trimmedServerApiKey;
  }

  // BYOK 兜底: a real browser key wins; otherwise fall back to the server key.
  if (browserApiKey) {
    return browserApiKey;
  }

  return trimmedServerApiKey ?? '';
}

/**
 * Parse and validate the x-gemini-upstream-base-url header. Returns a validated
 * trailing-slash-stripped base URL string, or null when the header is absent or
 * fails SSRF validation. When present and valid, the proxy uses this as the
 * upstream target instead of config.geminiApiBase.
 *
 * Security constraints (matching thirdPartyProxy):
 *  - https only
 *  - no embedded credentials
 *  - non-private network host (SSRF guard via isPrivateNetworkHostname)
 */
function resolveUpstreamBaseOverride(request: IncomingMessage): string | null {
  const raw = request.headers[GEMINI_UPSTREAM_BASE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (isPrivateNetworkHostname(url.hostname)) return null;
    return trimmed.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function buildProxyHeaders(request: IncomingMessage, apiKey: string): Headers {
  const headers = copyProxyRequestHeaders(request, STRIPPED_PROXY_REQUEST_HEADERS);

  headers.set('x-goog-api-key', apiKey);
  return headers;
}

function buildProxyResponseHeaders(
  request: IncomingMessage,
  upstreamResponse: Response,
  allowedOrigins: string[],
): Record<string, string> {
  const responseHeaders: Record<string, string> = {};
  const connectionManagedHeaders = getConnectionManagedHeaders(upstreamResponse.headers.get('connection'));

  upstreamResponse.headers.forEach((value, key) => {
    const normalizedName = key.toLowerCase();
    if (STRIPPED_PROXY_RESPONSE_HEADERS.has(normalizedName) || connectionManagedHeaders.has(normalizedName)) {
      return;
    }

    responseHeaders[normalizedName] = value;
  });

  Object.assign(responseHeaders, getCorsHeaders(request, allowedOrigins));
  return responseHeaders;
}

export async function proxyGeminiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: GeminiProxyConfig,
  fetchImpl: typeof fetch,
): Promise<void> {
  const apiKeyForProxy = resolveRequestApiKey(request, config.geminiApiKey, config.serverKeyPriority);

  if (!apiKeyForProxy) {
    sendJson(request, response, 500, { error: 'GEMINI_API_KEY is not configured.' }, config.allowedOrigins);
    return;
  }

  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const upstreamPath = requestUrl.pathname.slice(GEMINI_PROXY_PREFIX.length) || '/';

  // Override the upstream target when the browser sends a validated
  // x-gemini-upstream-base-url header (e.g. a user-configured proxy address).
  // When absent or invalid, falls back to config.geminiApiBase (the default).
  const upstreamBaseOverride = resolveUpstreamBaseOverride(request);
  const targetBase = upstreamBaseOverride ?? config.geminiApiBase.replace(/\/$/, '');
  const upstreamUrl = `${targetBase}${upstreamPath}${requestUrl.search}`;

  // Stream journal: when the browser sends an x-amc-job-id header on a
  // streamGenerateContent request, the upstream is buffered independently of
  // the browser connection so a page refresh can resume from the last seq.
  // No header → ordinary pass-through (today's behavior), fully reversible.
  if (
    await maybeStreamWithJob(request, response, upstreamPath, upstreamUrl, {
      geminiApiBase: config.geminiApiBase,
      geminiApiKey: config.geminiApiKey,
      allowedOrigins: config.allowedOrigins,
      serverKeyPriority: config.serverKeyPriority,
      fetchImpl,
    })
  ) {
    return;
  }

  const method = request.method || 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method);
  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };

  const requestInit: RequestInit & { duplex?: 'half' } = {
    method,
    headers: buildProxyHeaders(request, apiKeyForProxy),
    signal: abortController.signal,
    // redirect: 'manual' so a public GEMINI_API_BASE cannot 302 into a private network host
    // after the input URL passed validation.
    redirect: 'manual',
  };

  if (hasBody) {
    requestInit.body = request as unknown as BodyInit;
    requestInit.duplex = 'half';
  }

  request.once('aborted', abortUpstream);
  response.once('close', abortUpstream);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(upstreamUrl, requestInit);
  } catch (error) {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
    if (abortController.signal.aborted) {
      if (!response.destroyed) {
        response.destroy();
      }
      return;
    }

    console.error('[gemini] upstream request failed:', error);
    sendJson(request, response, 502, { error: 'Gemini upstream request failed.' }, config.allowedOrigins);
    return;
  }

  // Block redirects: Gemini's API does not legitimately redirect, and a 3xx here would mean
  // we did not follow it (good) but the upstream attempted to point us elsewhere.
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
    console.error('[gemini] upstream returned redirect:', upstreamResponse.status);
    sendJson(
      request,
      response,
      502,
      { error: 'Gemini upstream returned an unexpected redirect.' },
      config.allowedOrigins,
    );
    return;
  }

  response.writeHead(
    upstreamResponse.status,
    buildProxyResponseHeaders(request, upstreamResponse, config.allowedOrigins),
  );

  if (!upstreamResponse.body) {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
    response.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstreamResponse.body as unknown as NodeReadableStream), response);
  } catch (error) {
    if (!abortController.signal.aborted && !response.destroyed) {
      response.destroy(error instanceof Error ? error : undefined);
    }
  } finally {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
  }
}
