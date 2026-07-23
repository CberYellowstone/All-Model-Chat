/**
 * Append a decoded SSE chunk and normalize CRLF so event boundaries spanning
 * chunk splits (e.g. "\\r\\n" split as "\\r" | "\\n") still collapse to "\\n\\n".
 */
export const appendSseChunk = (buffer: string, chunk: string): string =>
  `${buffer}${chunk}`.replace(/\r\n/g, '\n');
