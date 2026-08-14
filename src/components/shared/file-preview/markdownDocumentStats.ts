interface MarkdownDocumentStats {
  characters: number;
  lines: number;
  words: number;
}

export const getMarkdownDocumentStats = (content: string): MarkdownDocumentStats => {
  if (!content) {
    return { characters: 0, lines: 0, words: 0 };
  }

  const lines = (content.match(/\r\n|\r|\n/g)?.length ?? 0) + 1;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return {
    characters: content.length,
    lines,
    words,
  };
};
