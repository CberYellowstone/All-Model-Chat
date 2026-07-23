export interface MarkdownTocItem {
  id: string;
  text: string;
  level: number;
  line: number;
  index: number;
}

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

const slugifyHeading = (text: string, index: number): string => {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return slug || `heading-${index}`;
};

export const extractMarkdownToc = (content: string): MarkdownTocItem[] => {
  if (!content) return [];

  const lines = content.split(/\r\n|\r|\n/);
  const items: MarkdownTocItem[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const match = lines[lineIndex].match(HEADING_REGEX);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].replace(/\s+#+\s*$/, '').trim();
    if (!text) continue;

    items.push({
      id: slugifyHeading(text, items.length),
      text,
      level,
      line: lineIndex,
      index: items.length,
    });
  }

  return items;
};
