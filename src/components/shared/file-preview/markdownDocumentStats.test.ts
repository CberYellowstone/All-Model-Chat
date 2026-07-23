import { describe, expect, it } from 'vitest';
import { getMarkdownDocumentStats } from './markdownDocumentStats';

describe('getMarkdownDocumentStats', () => {
  it('returns zeroed stats for empty content', () => {
    expect(getMarkdownDocumentStats('')).toEqual({ characters: 0, lines: 0, words: 0 });
  });

  it('counts characters, lines, and words', () => {
    expect(getMarkdownDocumentStats('one two\nthree')).toEqual({
      characters: 13,
      lines: 2,
      words: 3,
    });
  });
});
