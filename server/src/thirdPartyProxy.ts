import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { isPrivateNetworkHostname } from '../../shared/privateNetwork.js';
import { getCorsHeaders, sendJson } from './cors.js';
import type { ThirdPartyProxyRoute } from './config.js';
import { runDetachedUpstream, maybeStreamWithSharedJob, type StreamJob } from './streamJobStore.js';
import {
  STRIPPED_PROXY_RESPONSE_HEADERS,
  copyProxyRequestHeaders,
  getConnectionManagedHeaders,
} from './proxyHeaders.js';

export const OPENAI_PROXY_PREFIX = '/api/openai';

const STRIPPED_PROXY_REQUEST_HEADERS = new Set([
  'accept-encoding',
  'content-length',
  'cookie',
  'host',
  // The browser sends its provider key as Authorization / x-api-key. Under
  // BYOK 兜底 the browser key wins; otherwise the server route table key wins.
  'authorization',
  'x-api-key',
  // The browser supplies the provider's real baseUrl in pure-BYOK mode (no
  // route table entry). It is consumed by resolveRoute and must not leak
  // upstream.
  'x-third-party-base-url',
]);

const THIRD_PARTY_PROVIDER_HEADER = 'x-third-party-provider';
// When the server route table has no entry for a provider (pure BYOK), the
// browser supplies the provider's real baseUrl here so the proxy can still
// forward without a preconfigured THIRD_PARTY_ROUTES entry. Still SSRF-checked.
const THIRD_PARTY_BASE_URL_HEADER = 'x-third-party-base-url';

export interface ThirdPartyProxyConfig {
  thirdPartyRoutes: Record<string, ThirdPartyProxyRoute>;
  serverKeyPriority?: boolean;
  allowedOrigins: string[];
}

function resolveProviderId(request: IncomingMessage): string | null {
  const header = request.headers[THIRD_PARTY_PROVIDER_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return trimmed || null;
}

interface ResolvedRoute {
  baseUrl: string;
  apiKey: string | null;
  isBrowserKey: boolean;
}

const resolveRoute = (
  request: IncomingMessage,
  routes: Record<string, ThirdPartyProxyRoute>,
): { route?: ResolvedRoute; providerId: string; error?: { status: number; message: string } } => {
  const providerId = resolveProviderId(request) ?? 'openai';
  const route = routes[providerId] ?? routes['openai'];

  const browserAuthorization = request.headers['authorization'];
  const browserBearer =
    typeof browserAuthorization === 'string' && browserAuthorization.toLowerCase().startsWith('bearer ')
      ? browserAuthorization.slice(7).trim()
      : '';
  const browserApiKeyHeader = request.headers['x-api-key'];
  const browserApiKey = Array.isArray(browserApiKeyHeader)
    ? (browserApiKeyHeader[0]?.trim() ?? '')
    : (browserApiKeyHeader?.trim() ?? '');

  const browserKey = browserBearer || browserApiKey;

  // Pure BYOK path: no route table entry. The browser must supply both a real
  // key (BYOK) and the provider's real baseUrl; the server has no upstream to
  // fall back to. Still SSRF-checked before forwarding.
  if (!route) {
    const browserBaseUrlHeader = request.headers[THIRD_PARTY_BASE_URL_HEADER];
    const browserBaseUrlRaw = Array.isArray(browserBaseUrlHeader)
      ? (browserBaseUrlHeader[0]?.trim() ?? '')
      : (browserBaseUrlHeader?.trim() ?? '');

    if (browserKey && browserBaseUrlRaw) {
      return { route: { baseUrl: browserBaseUrlRaw, apiKey: browserKey, isBrowserKey: true }, providerId };
    }

    return {
      providerId,
      error: {
        status: 400,
        message: `Third-party provider "${providerId}" is not configured. Set a server route in THIRD_PARTY_ROUTES, or supply a browser key and baseUrl.`,
      },
    };
  }

  // BYOK 兜底: a real browser key wins; otherwise use the server route key.
  if (browserKey) {
    return { route: { baseUrl: route.baseUrl, apiKey: browserKey, isBrowserKey: true }, providerId };
  }

  if (route.apiKey) {
    return { route: { baseUrl: route.baseUrl, apiKey: route.apiKey, isBrowserKey: false }, providerId };
  }

  return {
    providerId,
    error: { status: 500, message: `No API key configured for third-party provider "${providerId}".` },
  };
};

function buildProxyHeaders(request: IncomingMessage, route: ResolvedRoute, providerId: string): Headers {
  const headers = copyProxyRequestHeaders(request, STRIPPED_PROXY_REQUEST_HEADERS);

  headers.set(THIRD_PARTY_PROVIDER_HEADER, providerId);

  // Anthropic uses x-api-key + anthropic-version; OpenAI-compatible uses Bearer.
  // The browser already sets content-type / anthropic-version on these requests;
  // re-stamp the auth header with the resolved (browser or server) key.
  if (route.apiKey) {
    headers.set('authorization', `Bearer ${route.apiKey}`);
    headers.set('x-api-key', route.apiKey);
  }

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

export async function proxyThirdPartyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: ThirdPartyProxyConfig,
  fetchImpl: typeof fetch,
): Promise<void> {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const upstreamPath = requestUrl.pathname.slice(OPENAI_PROXY_PREFIX.length) || '/';
  const method = request.method || 'GET';

  const resolved = resolveRoute(request, config.thirdPartyRoutes);
  if (resolved.error) {
    sendJson(request, response, resolved.error.status, { error: resolved.error.message }, config.allowedOrigins);
    return;
  }

  const route = resolved.route;
  if (!route) {
    sendJson(request, response, 400, { error: 'Third-party route could not be resolved.' }, config.allowedOrigins);
    return;
  }

  const targetBase = route.baseUrl.replace(/\/$/, '');
  const upstreamUrl = `${targetBase}${upstreamPath}${requestUrl.search}`;

  // SSRF guard: only allow https + non-private hosts from the route table.
  try {
    const upstream = new URL(upstreamUrl);
    if (upstream.protocol !== 'https:') {
      sendJson(request, response, 400, { error: 'Third-party upstream must use HTTPS.' }, config.allowedOrigins);
      return;
    }
    if (isPrivateNetworkHostname(upstream.hostname)) {
      sendJson(
        request,
        response,
        400,
        { error: `Third-party upstream host "${upstream.hostname}" is not allowed.` },
        config.allowedOrigins,
      );
      return;
    }
  } catch {
    sendJson(request, response, 400, { error: 'Invalid third-party upstream URL.' }, config.allowedOrigins);
    return;
  }

  // Stream journal: when the browser sends an x-amc-job-id header on a
  // streaming request, the upstream is buffered independently of the browser
  // connection so a page refresh can resume from the last seq — exactly like
  // the Gemini path. No header → ordinary pass-through (today's behavior),
  // fully reversible. The SSE split logic (\n\n boundaries, CRLF normalization)
  // in pumpUpstreamBodyIntoJob is provider-agnostic: OpenAI's `data: {...}\n\n`
  // frames, the trailing `[DONE]` marker, and Anthropic's `event:`/`data:`
  // blocks all split cleanly on \n\n and buffer as whole events.
  if (
    await maybeStreamWithSharedJob(request, response, { allowedOrigins: config.allowedOrigins }, (job) => {
      void runThirdPartyUpstream(job, request, upstreamUrl, route, resolved.providerId, fetchImpl);
    })
  ) {
    return;
  }

  const hasBody = !['GET', 'HEAD'].includes(method);
  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };

  const requestInit: RequestInit & { duplex?: 'half' } = {
    method,
    headers: buildProxyHeaders(request, route, resolved.providerId),
    signal: abortController.signal,
    // redirect: 'manual' so a public third-party baseUrl cannot 302 into a
    // private network host after the input URL passed validation.
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

    console.error('[third-party] upstream request failed:', error);
    sendJson(request, response, 502, { error: 'Third-party upstream request failed.' }, config.allowedOrigins);
    return;
  }

  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    request.off('aborted', abortUpstream);
    response.off('close', abortUpstream);
    console.error('[third-party] upstream returned redirect:', upstreamResponse.status);
    sendJson(
      request,
      response,
      502,
      { error: 'Third-party upstream returned an unexpected redirect.' },
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

/**
 * Detached upstream fetch for the third-party journal path. Mirrors the Gemini
 * runUpstream: fires the fetch on the job's abort signal (so the stream-abort
 * endpoint can kill it), pumps the SSE body into the job buffer, and finishes
 * the job on completion or error. A browser disconnect does NOT abort this —
 * only the stream-abort endpoint or the sweeper does.
 */
const runThirdPartyUpstream = (
  job: StreamJob,
  request: IncomingMessage,
  upstreamUrl: string,
  route: ResolvedRoute,
  providerId: string,
  fetchImpl: typeof fetch,
): Promise<void> =>
  runDetachedUpstream(job, request, upstreamUrl, () => buildProxyHeaders(request, route, providerId), fetchImpl);
