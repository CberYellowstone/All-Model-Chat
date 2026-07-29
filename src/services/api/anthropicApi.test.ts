import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sendAnthropicMessageNonStream, sendAnthropicMessageStream, fetchAnthropicModels } from './anthropicApi';

const mockResponse = (body: BodyInit, init?: ResponseInit) =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/json' }, ...init });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendAnthropicMessageNonStream', () => {
  it('sends POST with x-api-key header and returns text on complete', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(JSON.stringify({ content: [{ type: 'text', text: 'Hello' }] })),
    );
    const onComplete = vi.fn();
    await sendAnthropicMessageNonStream(
      'sk-key',
      'claude-sonnet-5',
      [],
      [{ text: 'hi' }],
      { baseUrl: 'https://api.anthropic.com' },
      new AbortController().signal,
      vi.fn(),
      onComplete,
      'user',
    );
    expect(onComplete).toHaveBeenCalled();
    const parts = onComplete.mock.calls[0][0];
    expect(parts).toEqual([{ text: 'Hello' }]);
    const callInit = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((callInit.headers as Record<string, string>)['x-api-key']).toBe('sk-key');
  });

  it('calls onError on non-ok response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(JSON.stringify({ error: { message: 'bad' } }), { status: 401 }),
    );
    const onError = vi.fn();
    await sendAnthropicMessageNonStream(
      'k',
      'm',
      [],
      [{ text: 'x' }],
      {},
      new AbortController().signal,
      onError,
      vi.fn(),
    );
    expect(onError).toHaveBeenCalled();
    expect((onError.mock.calls[0][0] as Error).message).toBe('bad');
  });

  it('collects thinking blocks into the onComplete thoughts argument', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(
        JSON.stringify({
          content: [
            { type: 'thinking', thinking: 'reasoning step' },
            { type: 'text', text: 'Answer' },
          ],
        }),
      ),
    );
    const onComplete = vi.fn();
    await sendAnthropicMessageNonStream(
      'k',
      'm',
      [],
      [{ text: 'x' }],
      {},
      new AbortController().signal,
      vi.fn(),
      onComplete,
    );
    expect(onComplete).toHaveBeenCalled();
    const [, thoughts, , , ,] = onComplete.mock.calls[0];
    expect(thoughts).toBe('reasoning step');
  });
});

describe('sendAnthropicMessageStream', () => {
  it('streams text deltas via onPart', async () => {
    const sseBody = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi "}}',
      '',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"there"}}',
      '',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
      '',
    ].join('\n');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(sseBody, { status: 200 }));
    const onPart = vi.fn();
    await sendAnthropicMessageStream(
      'k',
      'm',
      [],
      [{ text: 'x' }],
      {},
      new AbortController().signal,
      onPart,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    expect(onPart).toHaveBeenCalledTimes(2);
    expect(onPart.mock.calls[0][0]).toEqual({ text: 'Hi ' });
    expect(onPart.mock.calls[1][0]).toEqual({ text: 'there' });
  });

  it('routes thinking_delta events to onThoughtChunk', async () => {
    const sseBody = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"reasoning"}}',
      '',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Answer"}}',
      '',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
      '',
    ].join('\n');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(sseBody, { status: 200 }));
    const onPart = vi.fn();
    const onThoughtChunk = vi.fn();
    await sendAnthropicMessageStream(
      'k',
      'm',
      [],
      [{ text: 'x' }],
      {},
      new AbortController().signal,
      onPart,
      onThoughtChunk,
      vi.fn(),
      vi.fn(),
    );
    expect(onThoughtChunk).toHaveBeenCalledTimes(1);
    expect(onThoughtChunk.mock.calls[0][0]).toBe('reasoning');
    expect(onPart).toHaveBeenCalledTimes(1);
    expect(onPart.mock.calls[0][0]).toEqual({ text: 'Answer' });
  });
});

describe('fetchAnthropicModels', () => {
  it('returns deduped model options', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(JSON.stringify({ data: [{ id: 'claude-a' }, { id: 'claude-a' }, { id: 'claude-b' }] })),
    );
    const models = await fetchAnthropicModels('k', 'https://api.anthropic.com', new AbortController().signal);
    expect(models).toEqual([
      { id: 'claude-a', name: 'claude-a' },
      { id: 'claude-b', name: 'claude-b' },
    ]);
  });
});
