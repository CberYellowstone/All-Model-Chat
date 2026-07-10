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

  // Follow up to 3 redirects, re-validating each Location against the private-network
  // guard. Many CDNs (S3/CloudFront signed URLs) 302 to the final object; rejecting
  // those (as the previous unconditional 400 did) breaks legitimate image embedding.
  const MAX_REDIRECTS = 3;
  let currentUrl = targetUrl;
  let upstreamResponse: Response | undefined;
  let lastError: unknown;

  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  const timeout = setTimeout(abortUpstream, IMAGE_PROXY_TIMEOUT_MS);
  request.once('close', abortUpstream);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      try {
        upstreamResponse = await fetchImpl(currentUrl, {
          headers: {
            accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'user-agent': 'AMC-WebUI image proxy',
          },
          redirect: 'manual',
          signal: abortController.signal,
        });
      } catch (error) {
        lastError = error;
        break;
      }

      if (upstreamResponse.status < 300 || upstreamResponse.status >= 400) {
        break;
      }

      const location = upstreamResponse.headers.get('location');
      if (!location) {
        break;
      }
      const redirectUrl = new URL(location, currentUrl);
      if (isPrivateResponseUrl(redirectUrl.toString())) {
        sendJson(
          request,
          response,
          400,
          { error: 'Image proxy target attempted an unsafe redirect.' },
          allowedOrigins,
        );
        return;
      }
      if (redirectUrl.username || redirectUrl.password) {
        sendJson(
          request,
          response,
          400,
          { error: 'Image proxy target attempted an unsafe redirect.' },
          allowedOrigins,
        );
        return;
      }
      currentUrl = redirectUrl;
      upstreamResponse = undefined;
    }
  } finally {
    clearTimeout(timeout);
    request.off('close', abortUpstream);
  }

  if (!upstreamResponse) {
    const aborted = abortController.signal.aborted;
    const message =
      aborted && !request.destroyed ? 'Image proxy request timed out.' : lastError instanceof Error ? lastError.message : 'Unknown upstream error';
    console.error('[image-proxy] upstream request failed:', lastError);
    sendJson(request, response, aborted ? 504 : 502, { error: `Image proxy request failed: ${message}` }, allowedOrigins);
    return;
  }

  const finalUpstreamResponse = upstreamResponse;

  if (!finalUpstreamResponse.ok) {
    sendJson(
      request,
      response,
      502,
      { error: `Image proxy target returned ${finalUpstreamResponse.status}.` },
      allowedOrigins,
    );
    return;
  }

  const contentType = finalUpstreamResponse.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    sendJson(request, response, 415, { error: 'Image proxy target did not return an image.' }, allowedOrigins);
    return;
  }

  const contentLength = Number(finalUpstreamResponse.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_PROXY_BYTES) {
    sendJson(request, response, 413, { error: 'Image proxy target is too large.' }, allowedOrigins);
    return;
  }

  const body = new Uint8Array(await finalUpstreamResponse.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_PROXY_BYTES) {
    sendJson(request, response, 413, { error: 'Image proxy target is too large.' }, allowedOrigins);
    return;
  }

  response.writeHead(finalUpstreamResponse.status, {
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
