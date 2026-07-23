import { describe, expect, it } from 'vitest';
import { extractMarkdownToc } from './markdownToc';

describe('extractMarkdownToc', () => {
  it('extracts headings with levels and source line numbers', () => {
    const content = '# Title\n\n## Section\n\nBody\n\n### Details';

    expect(extractMarkdownToc(content)).toEqual([
      { id: 'title', text: 'Title', level: 1, line: 0, index: 0 },
      { id: 'section', text: 'Section', level: 2, line: 2, index: 1 },
      { id: 'details', text: 'Details', level: 3, line: 6, index: 2 },
    ]);
  });

  it('ignores non-heading lines and trims trailing markdown markers', () => {
    const content = '## Heading with suffix ##\n\nNot a heading';

    expect(extractMarkdownToc(content)).toEqual([
      { id: 'heading-with-suffix', text: 'Heading with suffix', level: 2, line: 0, index: 0 },
    ]);
  });
});
