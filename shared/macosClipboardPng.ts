import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const MAX_LOCAL_CLIPBOARD_IMAGE_BYTES = 25 * 1024 * 1024;
const CLIPBOARD_BASE64_BUFFER_FACTOR = 2;
const CLIPBOARD_BUFFER_PADDING_BYTES = 1024;
const PNG_HEX_PREFIX = '89504e470d0a1a0a';

const MACOS_CLIPBOARD_PNG_SCRIPT = `
(() => {
  ObjC.import('AppKit');
  ObjC.import('Foundation');
  const pasteboard = $.NSPasteboard.generalPasteboard;
  const data = pasteboard.dataForType($('public.png'));
  if (!data || data.isNil()) {
    return '';
  }
  return ObjC.unwrap(data.base64EncodedStringWithOptions(0));
})()
`.trim();

export interface MacOsClipboardPng {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

type ClipboardExecFileAsync = (
  file: string,
  args: string[],
  options: { encoding: 'utf8'; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultExecFileAsync = promisify(execFile) as ClipboardExecFileAsync;

function parsePngBase64Data(value: string): Buffer | null {
  const base64 = value.trim();
  if (!base64) {
    return null;
  }

  const data = Buffer.from(base64, 'base64');
  if (!data.byteLength || !data.toString('hex', 0, 8).startsWith(PNG_HEX_PREFIX)) {
    return null;
  }

  return data;
}

/**
 * Read a PNG from the macOS general pasteboard via osascript.
 * Shared by the production API server and the Vite dev local-API plugin.
 */
export async function readMacOsClipboardPng(
  execFileImpl: ClipboardExecFileAsync = defaultExecFileAsync,
  platform: NodeJS.Platform = process.platform,
): Promise<MacOsClipboardPng | null> {
  if (platform !== 'darwin') {
    return null;
  }

  let stdout: string;
  try {
    const result = await execFileImpl('osascript', ['-l', 'JavaScript', '-e', MACOS_CLIPBOARD_PNG_SCRIPT], {
      encoding: 'utf8',
      // Base64 expands bytes ~2x; add padding for the JSON wrapper overhead.
      maxBuffer: MAX_LOCAL_CLIPBOARD_IMAGE_BYTES * CLIPBOARD_BASE64_BUFFER_FACTOR + CLIPBOARD_BUFFER_PADDING_BYTES,
    });
    stdout = result.stdout;
  } catch {
    return null;
  }

  const data = parsePngBase64Data(stdout);
  if (!data || data.byteLength > MAX_LOCAL_CLIPBOARD_IMAGE_BYTES) {
    return null;
  }

  return {
    data,
    mimeType: 'image/png',
    fileName: 'clipboard-image.png',
  };
}
