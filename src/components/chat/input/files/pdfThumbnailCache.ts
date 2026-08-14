/**
 * Module-level PDF thumbnail cache (PNG data URLs from ~92px canvases).
 * Bounded LRU so long sessions with many distinct PDFs cannot grow without limit.
 * Same Map insertion-order pattern as GraphvizBlock / usePyodide.
 */
export const PDF_THUMBNAIL_CACHE_LIMIT = 32;

const pdfThumbnailImageCache = new Map<string, string>();

export const readPdfThumbnailCache = (key: string): string | undefined => {
  const cached = pdfThumbnailImageCache.get(key);
  if (!cached) {
    return undefined;
  }
  pdfThumbnailImageCache.delete(key);
  pdfThumbnailImageCache.set(key, cached);
  return cached;
};

export const writePdfThumbnailCache = (key: string, value: string) => {
  pdfThumbnailImageCache.delete(key);
  pdfThumbnailImageCache.set(key, value);
  while (pdfThumbnailImageCache.size > PDF_THUMBNAIL_CACHE_LIMIT) {
    const oldestKey = pdfThumbnailImageCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    pdfThumbnailImageCache.delete(oldestKey);
  }
};

/** Test helper — not used by production UI. */
export const clearPdfThumbnailCache = () => {
  pdfThumbnailImageCache.clear();
};

/** Test helper — not used by production UI. */
export const getPdfThumbnailCacheSize = () => pdfThumbnailImageCache.size;
