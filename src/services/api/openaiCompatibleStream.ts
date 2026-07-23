import type { OpenAIResponsePayload } from './openaiCompatibleTypes';
import { appendSseChunk } from './sseBuffer';

const parseSseDataLines = (buffer: string): { events: string[]; rest: string } => {
  const events: string[] = [];
  let searchStart = 0;
  let boundaryIndex = buffer.indexOf('\n\n', searchStart);

  while (boundaryIndex !== -1) {
    const rawEvent = buffer.slice(searchStart, boundaryIndex);
    const eventData = rawEvent
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (eventData) {
      events.push(eventData);
    }

    searchStart = boundaryIndex + 2;
    boundaryIndex = buffer.indexOf('\n\n', searchStart);
  }

  return { events, rest: buffer.slice(searchStart) };
};

export const readOpenAICompatibleStreamEvents = async (
  response: Response,
  abortSignal: AbortSignal,
  onEvent: (payload: OpenAIResponsePayload) => void,
): Promise<void> => {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || abortSignal.aborted) {
        break;
      }

      buffer = appendSseChunk(buffer, decoder.decode(value, { stream: true }));
      const parsed = parseSseDataLines(buffer);
      buffer = parsed.rest;

      for (const event of parsed.events) {
        if (event === '[DONE]') {
          return;
        }
        // Skip malformed SSE lines instead of aborting the whole stream.
        try {
          onEvent(JSON.parse(event) as OpenAIResponsePayload);
        } catch {
          // Ignore unparseable event and continue.
        }
      }
    }

    const tail = decoder.decode();
    if (tail) {
      buffer = appendSseChunk(buffer, tail);
    }
    const parsed = parseSseDataLines(`${buffer}\n\n`);
    for (const event of parsed.events) {
      if (event !== '[DONE]') {
        try {
          onEvent(JSON.parse(event) as OpenAIResponsePayload);
        } catch {
          // Ignore unparseable event and continue.
        }
      }
    }
  } finally {
    // Release the reader so the underlying HTTP/TLS connection is returned to the pool.
    await reader.cancel().catch(() => undefined);
  }
};
