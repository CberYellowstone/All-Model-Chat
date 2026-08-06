import { describe, it, expect } from 'vitest';
import { getThinkingStreamTail, createUploadedFileFromBytes } from './parsing';

describe('createUploadedFileFromBytes', () => {
  it('builds an UploadedFile directly from an ArrayBuffer without base64 decoding', () => {
    const buffer = new ArrayBuffer(3);
    new Uint8Array(buffer).set([1, 2, 3]);

    const file = createUploadedFileFromBytes(buffer, 'image/png', 'plot');

    expect(file.type).toBe('image/png');
    expect(file.name).toMatch(/^plot\.png$/);
    expect(file.size).toBe(3);
    expect(file.rawFile).toBeInstanceOf(File);
    expect(file.uploadState).toBe('active');
    expect(file.id).toEqual(expect.any(String));
    expect(file.dataUrl).toEqual(expect.any(String));
  });
});

describe('getThinkingStreamTail', () => {
  it('returns empty string for undefined input', () => {
    expect(getThinkingStreamTail(undefined, 5)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(getThinkingStreamTail('', 5)).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(getThinkingStreamTail('   \n  ', 5)).toBe('');
  });

  it('strips ## and ### heading markers down to plain text lines', () => {
    const result = getThinkingStreamTail('## Step 1\nFirst thought\n### Analysis\nDeep analysis here', 5);
    expect(result).toBe('Step 1\nFirst thought\nAnalysis\nDeep analysis here');
  });

  it('strips full-line **bold** markers', () => {
    const result = getThinkingStreamTail('**Reasoning**\nSome reasoning text', 5);
    expect(result).toBe('Reasoning\nSome reasoning text');
  });

  it('strips full-line __underline__ markers', () => {
    const result = getThinkingStreamTail('__Planning__\nPlan details', 5);
    expect(result).toBe('Planning\nPlan details');
  });

  it('filters blank lines and joins the rest with a single newline', () => {
    const result = getThinkingStreamTail('## Title\n  \n  Content line  \n  \nSecond', 5);
    expect(result).toBe('Title\nContent line\nSecond');
  });

  it('keeps only the last maxLines source lines', () => {
    const lines = Array.from({ length: 30 }, (_, index) => `Line ${index + 1}`);
    const result = getThinkingStreamTail(lines.join('\n'), 24);
    const resultLines = result.split('\n');
    expect(resultLines.length).toBe(24);
    // 30 lines, keep last 24 → the first kept line is Line 7.
    expect(resultLines[0]).toBe('Line 7');
    expect(resultLines[resultLines.length - 1]).toBe('Line 30');
  });
});
