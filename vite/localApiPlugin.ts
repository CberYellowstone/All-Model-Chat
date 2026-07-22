import { Buffer } from 'node:buffer';
import type { IncomingHttpHeaders } from 'node:http';
import type { Plugin } from 'vite';
import { parseAllowedImageProxyUrl } from '../shared/imageProxyUrl';
import { readMacOsClipboardPng } from '../shared/macosClipboardPng';

const IMAGE_PROXY_PATH = '/api/image-proxy';
const LOCAL_CLIPBOARD_IMAGE_PATH = '/api/local-clipboard-image';
const MCP_API_PREFIX = '/api/mcp';
const DEFAULT_MCP_API_BASE_URL = 'http://127.0.0.1:3001';
const MAX_IMAGE_PROXY_BYTES = 25 * 1024 * 1024;

type DevServerRequest = {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string | Uint8Array>;
};
type DevServerResponse = {
  writeHead: (status: number, headers: Record<string, string>) => void;
  end: (body?: string | Uint8Array) => void;
};

const writeImageProxyJson = (
  response: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body?: string) => void },
  statusCode: number,
  body: Record<string, unknown>,
) => {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

const getMcpApiBaseUrl = (): string => process.env.MCP_API_BASE_URL?.trim() || DEFAULT_MCP_API_BASE_URL;

const isMcpApiPath = (pathname: string): boolean =>
  pathname === MCP_API_PREFIX || pathname.startsWith(`${MCP_API_PREFIX}/`);

const createForwardHeaders = (headers: IncomingHttpHeaders | undefined): Headers => {
  const forwardedHeaders = new Headers();

  for (const [name, value] of Object.entries(headers ?? {})) {
    if (typeof value === 'string') {
      forwardedHeaders.set(name, value);
    } else if (Array.isArray(value)) {
      forwardedHeaders.set(name, value.join(', '));
    }
  }

  forwardedHeaders.delete('connection');
  forwardedHeaders.delete('host');
  return forwardedHeaders;
};

const readRequestBody = async (request: DevServerRequest): Promise<Blob | undefined> => {
  if (!request[Symbol.asyncIterator]) {
    return undefined;
  }

  const chunks: BlobPart[] = [];
  let totalBytes = 0;
  for await (const chunk of request as AsyncIterable<Buffer | string | Uint8Array>) {
    const blobPart = typeof chunk === 'string' ? chunk : new Uint8Array(chunk);
    totalBytes += typeof blobPart === 'string' ? Buffer.byteLength(blobPart) : blobPart.byteLength;
    chunks.push(blobPart);
  }

  if (totalBytes === 0) {
    return undefined;
  }

  return new Blob(chunks);
};

const writeMcpProxyJson = (response: DevServerResponse, statusCode: number, body: Record<string, unknown>) => {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

const proxyMcpApiRequest = async (
  request: DevServerRequest,
  response: DevServerResponse,
  requestUrl: URL,
): Promise<void> => {
  const method = request.method ?? 'GET';
  const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, getMcpApiBaseUrl());
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), {
      method,
      headers: createForwardHeaders(request.headers),
      body: method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    writeMcpProxyJson(response, 502, { error: `MCP API proxy request failed: ${message}` });
    return;
  }

  const responseHeaders: Record<string, string> = {};
  upstreamResponse.headers.forEach((value, name) => {
    responseHeaders[name] = value;
  });

  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  response.writeHead(upstreamResponse.status, responseHeaders);
  response.end(method === 'HEAD' ? undefined : body);
};

const proxyImageRequest = async (request: DevServerRequest, response: DevServerResponse) => {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    writeImageProxyJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const targetUrl = parseAllowedImageProxyUrl(requestUrl.searchParams.get('url'));
  if (!targetUrl) {
    writeImageProxyJson(response, 400, { error: 'Image proxy URL is not allowed.' });
    return;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'AMC-WebUI image proxy',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    writeImageProxyJson(response, 502, { error: `Image proxy request failed: ${message}` });
    return;
  }

  if (!upstreamResponse.ok) {
    writeImageProxyJson(response, 502, { error: `Image proxy target returned ${upstreamResponse.status}.` });
    return;
  }

  const contentType = upstreamResponse.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    writeImageProxyJson(response, 415, { error: 'Image proxy target did not return an image.' });
    return;
  }

  const contentLength = Number(upstreamResponse.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_PROXY_BYTES) {
    writeImageProxyJson(response, 413, { error: 'Image proxy target is too large.' });
    return;
  }

  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_PROXY_BYTES) {
    writeImageProxyJson(response, 413, { error: 'Image proxy target is too large.' });
    return;
  }

  response.writeHead(upstreamResponse.status, {
    'content-type': contentType,
    'cache-control': 'public, max-age=86400',
    'x-content-type-options': 'nosniff',
  });
  response.end(method === 'HEAD' ? undefined : body);
};

const localClipboardImageRequest = async (request: { method?: string }, response: DevServerResponse) => {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    writeImageProxyJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const image = await readMacOsClipboardPng();
  if (!image) {
    writeImageProxyJson(response, 404, { error: 'No local clipboard image is available.' });
    return;
  }

  response.writeHead(200, {
    'content-type': image.mimeType,
    'content-length': String(image.data.byteLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-clipboard-file-name': image.fileName,
  });
  response.end(method === 'HEAD' ? undefined : image.data);
};

const handleLocalApiRequest = (request: DevServerRequest, response: DevServerResponse, next: () => void) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');

  if (requestUrl.pathname === IMAGE_PROXY_PATH) {
    void proxyImageRequest(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown image proxy error';
      writeImageProxyJson(response, 500, { error: message });
    });
    return;
  }

  if (requestUrl.pathname === LOCAL_CLIPBOARD_IMAGE_PATH) {
    void localClipboardImageRequest(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown local clipboard image error';
      writeImageProxyJson(response, 500, { error: message });
    });
    return;
  }

  if (isMcpApiPath(requestUrl.pathname)) {
    void proxyMcpApiRequest(request, response, requestUrl).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown MCP API proxy error';
      writeMcpProxyJson(response, 500, { error: message });
    });
    return;
  }

  next();
};

export const createLocalApiPlugin = (): Plugin => ({
  name: 'amc-local-api',
  configureServer(server) {
    server.middlewares.use(handleLocalApiRequest);
  },
  configurePreviewServer(server) {
    server.middlewares.use(handleLocalApiRequest);
  },
});
