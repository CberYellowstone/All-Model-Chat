import type { IncomingMessage, ServerResponse } from 'node:http';
import { readMacOsClipboardPng, type MacOsClipboardPng } from '../../shared/macosClipboardPng.js';
import { getCorsHeaders, sendJson } from './cors.js';

export const LOCAL_CLIPBOARD_IMAGE_PATH = '/api/local-clipboard-image';

export type { MacOsClipboardPng as LocalClipboardImage };
export { readMacOsClipboardPng };

export async function handleLocalClipboardImageRequest(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
  readLocalClipboardImage: () => Promise<MacOsClipboardPng | null>,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(request, response, 405, { error: 'Method not allowed' }, allowedOrigins);
    return;
  }

  const image = await readLocalClipboardImage();
  if (!image) {
    sendJson(request, response, 404, { error: 'No local clipboard image is available.' }, allowedOrigins);
    return;
  }

  response.writeHead(200, {
    ...getCorsHeaders(request, allowedOrigins),
    'content-type': image.mimeType,
    'content-length': String(image.data.byteLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-clipboard-file-name': encodeURIComponent(image.fileName),
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  response.end(image.data);
}
