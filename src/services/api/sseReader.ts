import { appendSseChunk } from './sseBuffer';

type SseStreamParser<T> = (buffer: string) => { events: T[]; rest: string };

/**
 * Read a streaming SSE body to completion, parsing events with `parse` and
 * invoking `onEvent` for each. Stops early when `isDone` returns true for an
 * event (used for terminal markers like Anthropic's `message_stop` or OpenAI's
 * `[DONE]`). The reader is always released (cancel) so the connection returns
 * to the pool.
 */
export const readSseStream = async <T>(
  response: Response,
  abortSignal: AbortSignal,
  parse: SseStreamParser<T>,
  onEvent: (event: T) => void,
  isDone?: (event: T) => boolean,
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
      if (done || abortSignal.aborted) break;

      buffer = appendSseChunk(buffer, decoder.decode(value, { stream: true }));
      const parsed = parse(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        onEvent(event);
        if (isDone?.(event)) {
          return;
        }
      }
    }

    const tail = decoder.decode();
    if (tail) {
      buffer = appendSseChunk(buffer, tail);
    }
    const parsed = parse(`${buffer}\n\n`);
    for (const event of parsed.events) {
      onEvent(event);
    }
  } finally {
    // Release the reader so the underlying HTTP/TLS connection is returned to the pool.
    await reader.cancel().catch(() => undefined);
  }
};
