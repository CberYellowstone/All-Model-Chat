import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCorsHeaders, sendJson } from './cors.js';
import { isPrivateNetworkHostname } from './privateNetwork.js';

export const IMAGE_PROXY_PATH = '/api/image-proxy';

const MAX_IMAGE_PROXY_BYTES = 25 * 1024 * 1024;
const IMAGE_PROXY_TIMEOUT_MS = 15_000;

function parseAllowedImageProxyUrl(value: string | null): URL | null {
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }
    if (parsedUrl.username || parsedUrl.password || isPrivateNetworkHostname(parsedUrl.hostname)) {
      return null;
    }
    return parsedUrl;
  } catch {
    return null;
  }
}

// Reject any URL whose final resolved host is private. Guards against DNS rebinding and
// cross-origin redirects that land on internal services after the input-URL check passes.
const isPrivateResponseUrl = (responseUrl: string): boolean => {
  try {
    return isPrivateNetworkHostname(new URL(responseUrl).hostname);
  } catch {
    return true;
  }
};

export async function proxyExternalImage(
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
  allowedOrigins: string[],
  fetchImpl: typeof fetch,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(request, response, 405, { error: 'Method not allowed' }, allowedOrigins);
    return;
  }

  const targetUrl = parseAllowedImageProxyUrl(requestUrl.searchParams.get('url'));
  if (!targetUrl) {
    sendJson(request, response, 400, { error: 'Image proxy URL is not allowed.' }, allowedOrigins);
    return;
  }

  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  const timeout = setTimeout(abortUpstream, IMAGE_PROXY_TIMEOUT_MS);
  request.once('close', abortUpstream);

  let upstreamResponse: Response;
  try {
    // redirect: 'manual' so redirects cannot bypass the private-network check on the input URL.
    upstreamResponse = await fetchImpl(targetUrl, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'AMC-WebUI image proxy',
      },
      redirect: 'manual',
      signal: abortController.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    request.off('close', abortUpstream);
    const aborted = abortController.signal.aborted;
    const message =
      aborted && !request.destroyed ? 'Image proxy request timed out.' : error instanceof Error ? error.message : 'Unknown upstream error';
    console.error('[image-proxy] upstream request failed:', error);
    sendJson(request, response, aborted ? 504 : 502, { error: `Image proxy request failed: ${message}` }, allowedOrigins);
    return;
  }

  clearTimeout(timeout);
  request.off('close', abortUpstream);

  // A 3xx here means the upstream tried to redirect; we did not follow it. Block unless the
  // redirect target is itself a safe (non-private) URL — re-validate before considering follow.
  if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
    const location = upstreamResponse.headers.get('location');
    if (!location || isPrivateResponseUrl(new URL(location, targetUrl).toString())) {
      sendJson(request, response, 400, { error: 'Image proxy target attempted an unsafe redirect.' }, allowedOrigins);
      return;
    }
    sendJson(request, response, 400, { error: 'Image proxy target returned a redirect.' }, allowedOrigins);
    return;
  }

  if (!upstreamResponse.ok) {
    sendJson(
      request,
      response,
      502,
      { error: `Image proxy target returned ${upstreamResponse.status}.` },
      allowedOrigins,
    );
    return;
  }

  const contentType = upstreamResponse.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    sendJson(request, response, 415, { error: 'Image proxy target did not return an image.' }, allowedOrigins);
    return;
  }

  const contentLength = Number(upstreamResponse.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_PROXY_BYTES) {
    sendJson(request, response, 413, { error: 'Image proxy target is too large.' }, allowedOrigins);
    return;
  }

  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_PROXY_BYTES) {
    sendJson(request, response, 413, { error: 'Image proxy target is too large.' }, allowedOrigins);
    return;
  }

  response.writeHead(upstreamResponse.status, {
    ...getCorsHeaders(request, allowedOrigins),
    'content-type': contentType,
    'cache-control': 'public, max-age=86400',
    'x-content-type-options': 'nosniff',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  response.end(body);
}
