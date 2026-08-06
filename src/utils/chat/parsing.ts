import { type UploadedFile } from '@/types';
import { generateUniqueId } from './ids';
import { base64ToBlob } from '@/utils/file/fileEncoding';
import { getExtensionFromMimeType } from '@/utils/file/fileMime';
import { createManagedObjectUrl } from '@/services/objectUrlManager';

const buildGeneratedFileName = (baseName: string, extension: string): string => {
  if (baseName.toLowerCase().endsWith(extension)) {
    return baseName;
  }

  if (baseName === 'generated-file' || baseName === 'generated-image') {
    return `${baseName}-${generateUniqueId().slice(-4)}${extension}`;
  }

  return `${baseName}${extension}`;
};

/**
 * Creates a standardized UploadedFile object from Base64 data.
 * Used for handling generated content from API (images, audio, etc.)
 */
export const createUploadedFileFromBase64 = (
  base64Data: string,
  mimeType: string,
  baseName: string = 'generated-file',
): UploadedFile => {
  const extension = getExtensionFromMimeType(mimeType);
  const fileName = buildGeneratedFileName(baseName, extension);

  const blob = base64ToBlob(base64Data, mimeType);
  const file = new File([blob], fileName, { type: mimeType });
  const dataUrl = createManagedObjectUrl(file);

  return {
    id: generateUniqueId(),
    name: fileName,
    type: mimeType,
    size: blob.size,
    dataUrl,
    rawFile: file,
    uploadState: 'active',
  };
};

/**
 * Creates an UploadedFile directly from raw bytes, skipping the base64
 * encode/decode round-trip used by {@link createUploadedFileFromBase64}.
 * Used for Pyodide execution artifacts, which arrive as zero-copy ArrayBuffers.
 */
export const createUploadedFileFromBytes = (
  bytes: ArrayBuffer,
  mimeType: string,
  baseName: string = 'generated-file',
): UploadedFile => {
  const extension = getExtensionFromMimeType(mimeType);
  const fileName = buildGeneratedFileName(baseName, extension);

  const file = new File([bytes], fileName, { type: mimeType });
  const dataUrl = createManagedObjectUrl(file);

  return {
    id: generateUniqueId(),
    name: fileName,
    type: mimeType,
    size: bytes.byteLength,
    dataUrl,
    rawFile: file,
    uploadState: 'active',
  };
};

/**
 * Extracts a plain-text tail of the thought stream for the ThinkingStrip.
 * Strips markdown heading markers (`## `) and full-line bold markers (`**x**` / `__x__`)
 * because the strip is a plain-text preview (Gemini heading streams would otherwise
 * show literal `## ` characters). Bounded to the last `maxLines` source lines.
 */
export const getThinkingStreamTail = (thoughts: string | undefined, maxLines: number): string => {
  if (!thoughts) {
    return '';
  }

  return thoughts
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^\*\*(.+)\*\*$/, '$1')
        .replace(/^__(.+)__$/, '$1'),
    )
    .slice(-maxLines)
    .join('\n');
};
