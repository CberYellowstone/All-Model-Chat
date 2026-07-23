import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchImageProxyWithSafeRedirects } from '../../shared/imageProxyFetch.js';
import { parseAllowedImageProxyUrl } from '../../shared/imageProxyUrl.js';
import { getCorsHeaders, sendJson } from './cors.js';

export const IMAGE_PROXY_PATH = '/api/image-proxy';

const MAX_IMAGE_PROXY_BYTES = 25 * 1024 * 1024;
const IMAGE_PROXY_TIMEOUT_MS = 15_000;

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

  // Follow redirects with per-hop private-network + DNS rebinding checks (shared with Vite).
  const abortController = new AbortController();
  const abortUpstream = () => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  const timeout = setTimeout(abortUpstream, IMAGE_PROXY_TIMEOUT_MS);
  request.once('close', abortUpstream);

  let fetchResult: Awaited<ReturnType<typeof fetchImageProxyWithSafeRedirects>>;
  try {
    fetchResult = await fetchImageProxyWithSafeRedirects(targetUrl, {
      fetchImpl,
      signal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
    request.off('close', abortUpstream);
  }

  if (!fetchResult.ok) {
    if (fetchResult.kind === 'unsafe_redirect') {
      sendJson(
        request,
        response,
        400,
        { error: 'Image proxy target attempted an unsafe redirect.' },
        allowedOrigins,
      );
      return;
    }

    if (fetchResult.kind === 'blocked') {
      sendJson(request, response, 400, { error: fetchResult.message }, allowedOrigins);
      return;
    }

    const aborted = abortController.signal.aborted;
    const message =
      aborted && !request.destroyed
        ? 'Image proxy request timed out.'
        : fetchResult.kind === 'fetch_error' && fetchResult.error instanceof Error
          ? fetchResult.error.message
          : 'Unknown upstream error';
    console.error(
      '[image-proxy] upstream request failed:',
      fetchResult.kind === 'fetch_error' ? fetchResult.error : fetchResult.kind,
    );
    sendJson(request, response, aborted ? 504 : 502, { error: `Image proxy request failed: ${message}` }, allowedOrigins);
    return;
  }

  const finalUpstreamResponse = fetchResult.response;

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
