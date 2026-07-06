import { describe, it, expect } from 'vitest';
import { MediaResolution } from '@/types';
import { estimateVideoTokens, parseOffsetSeconds, estimateVideoTokensForFiles } from './tokenEstimation';

describe('parseOffsetSeconds', () => {
  it('parses "10s" form', () => {
    expect(parseOffsetSeconds('10s')).toBe(10);
    expect(parseOffsetSeconds('10.5s')).toBe(10.5);
  });

  it('returns null for other forms', () => {
    expect(parseOffsetSeconds(undefined)).toBeNull();
    expect(parseOffsetSeconds('')).toBeNull();
    expect(parseOffsetSeconds('00:10')).toBeNull();
  });
});

describe('estimateVideoTokens', () => {
  it('Gemini 3 default = 70 tokens/frame at 1 fps', () => {
    // 60s × 1 fps × 70 = 4200
    expect(estimateVideoTokens(60, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(4200);
  });

  it('Gemini 3 high = 280 tokens/frame', () => {
    // 60s × 1 fps × 280 = 16800
    expect(estimateVideoTokens(60, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_HIGH)).toBe(16800);
  });

  it('Gemini 3 ultra_high falls back to high (N/A for video)', () => {
    expect(estimateVideoTokens(60, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_ULTRA_HIGH)).toBe(16800);
  });

  it('Gemini 3 honours custom fps', () => {
    // 10s × 2 fps × 70 = 1400
    expect(estimateVideoTokens(10, 'gemini-3.1-flash', MediaResolution.MEDIA_RESOLUTION_MEDIUM, 2)).toBe(1400);
  });

  it('legacy Gemini = 263 tokens/second', () => {
    // 60s × 263 = 15780
    expect(estimateVideoTokens(60, 'gemini-2.5-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(15780);
    // resolution is ignored for legacy models (no published per-level table)
    expect(estimateVideoTokens(60, 'gemini-2.5-pro', MediaResolution.MEDIA_RESOLUTION_HIGH)).toBe(15780);
  });

  it('zero / negative / non-finite duration → 0', () => {
    expect(estimateVideoTokens(0, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(0);
    expect(estimateVideoTokens(-5, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(0);
    expect(estimateVideoTokens(NaN, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(0);
  });
});

describe('estimateVideoTokensForFiles', () => {
  const baseVideo = {
    type: 'video/mp4',
    rawFile: new Blob(['x'], { type: 'video/mp4' }),
  };

  it('returns 0 when no files', async () => {
    expect(await estimateVideoTokensForFiles([], 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(0);
  });

  it('skips non-video files', async () => {
    const files = [{ ...baseVideo, type: 'image/png' }];
    expect(await estimateVideoTokensForFiles(files, 'gemini-3-pro', MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED)).toBe(
      0,
    );
  });

  it('returns 0 when duration cannot be read (no blob, no dataUrl)', async () => {
    const files = [{ type: 'video/mp4' }];
    // getVideoDurationSeconds returns null → contribution 0
    const result = await estimateVideoTokensForFiles(
      files,
      'gemini-3-pro',
      MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
    );
    expect(result).toBe(0);
  });

  it('honours start/end offsets when both set', async () => {
    const files = [
      {
        ...baseVideo,
        videoMetadata: { startOffset: '10s', endOffset: '40s' }, // 30s span
      },
    ];
    const result = await estimateVideoTokensForFiles(
      files,
      'gemini-3-pro',
      MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
    );
    // 30s × 1 fps × 70 = 2100
    expect(result).toBe(2100);
  });

  it('uses file-level mediaResolution override when set', async () => {
    const files = [
      {
        ...baseVideo,
        videoMetadata: { startOffset: '0s', endOffset: '10s' }, // 10s
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH, // 280/frame
      },
    ];
    const result = await estimateVideoTokensForFiles(
      files,
      'gemini-3-pro',
      MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED,
    );
    // 10s × 1 fps × 280 = 2800
    expect(result).toBe(2800);
  });
});
