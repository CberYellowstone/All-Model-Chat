import { describe, expect, it } from 'vitest';
import { parseAnthropicSseEvents } from './anthropicStream';
import { appendSseChunk } from './sseBuffer';

describe('appendSseChunk', () => {
  it('normalizes CRLF after each append so split event boundaries still parse', () => {
    // Simulates "\\r\\n\\r\\n" split across two TCP/SSE chunks as "\\r" | "\\n\\r\\n..."
    let buffer = '';
    buffer = appendSseChunk(buffer, 'event: content_block_delta\r\ndata: {"type":"ping"}\r\n\r');
    expect(buffer).toBe('event: content_block_delta\ndata: {"type":"ping"}\n\r');

    buffer = appendSseChunk(buffer, '\nevent: message_stop\r\ndata: {"type":"message_stop"}\r\n\r\n');
    expect(buffer).toBe(
      'event: content_block_delta\ndata: {"type":"ping"}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
    );

    const { events, rest } = parseAnthropicSseEvents(buffer);
    expect(rest).toBe('');
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('ping');
    expect(events[1].type).toBe('message_stop');
  });

  it('collapses CRLF in a single chunk', () => {
    expect(appendSseChunk('', 'data: x\r\n\r\n')).toBe('data: x\n\n');
  });
});
