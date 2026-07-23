import { afterEach, describe, expect, it } from 'vitest';
import {
  PDF_THUMBNAIL_CACHE_LIMIT,
  clearPdfThumbnailCache,
  getPdfThumbnailCacheSize,
  readPdfThumbnailCache,
  writePdfThumbnailCache,
} from './pdfThumbnailCache';

describe('pdfThumbnailCache', () => {
  afterEach(() => {
    clearPdfThumbnailCache();
  });

  it('evicts the least-recently-used entry once the limit is exceeded', () => {
    for (let index = 0; index < PDF_THUMBNAIL_CACHE_LIMIT; index += 1) {
      writePdfThumbnailCache(`key-${index}`, `data-${index}`);
    }

    expect(getPdfThumbnailCacheSize()).toBe(PDF_THUMBNAIL_CACHE_LIMIT);
    expect(readPdfThumbnailCache('key-0')).toBe('data-0');

    writePdfThumbnailCache('key-overflow', 'data-overflow');

    expect(getPdfThumbnailCacheSize()).toBe(PDF_THUMBNAIL_CACHE_LIMIT);
    // key-0 was promoted by the read above, so the next oldest (key-1) is evicted.
    expect(readPdfThumbnailCache('key-1')).toBeUndefined();
    expect(readPdfThumbnailCache('key-0')).toBe('data-0');
    expect(readPdfThumbnailCache('key-overflow')).toBe('data-overflow');
  });

  it('promotes an entry to most-recently-used on write of the same key', () => {
    writePdfThumbnailCache('a', '1');
    writePdfThumbnailCache('b', '2');
    writePdfThumbnailCache('a', '1-updated');

    for (let index = 0; index < PDF_THUMBNAIL_CACHE_LIMIT - 1; index += 1) {
      writePdfThumbnailCache(`fill-${index}`, `v-${index}`);
    }

    expect(readPdfThumbnailCache('b')).toBeUndefined();
    expect(readPdfThumbnailCache('a')).toBe('1-updated');
  });
});
