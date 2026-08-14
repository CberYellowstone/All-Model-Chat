import { describe, expect, it } from 'vitest';
import { extractAnthropicMessageText, extractAnthropicMessageThoughts } from './anthropicResponses';
import type { AnthropicResponsePayload } from './anthropicTypes';
import { readResponseErrorMessage } from '@/utils/errorMessage';

describe('anthropicResponses', () => {
  it('joins text content blocks', () => {
    const payload: AnthropicResponsePayload = {
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(extractAnthropicMessageText(payload)).toBe('Hello world');
  });

  it('excludes thinking blocks from the visible text', () => {
    const payload: AnthropicResponsePayload = {
      content: [
        { type: 'thinking', thinking: 'reasoning here' },
        { type: 'text', text: 'Answer' },
      ],
    };
    expect(extractAnthropicMessageText(payload)).toBe('Answer');
  });

  it('returns empty string when no content blocks', () => {
    expect(extractAnthropicMessageText({})).toBe('');
  });

  it('extracts thinking blocks into a joined thoughts string', () => {
    const payload: AnthropicResponsePayload = {
      content: [
        { type: 'thinking', thinking: 'step one' },
        { type: 'text', text: 'visible' },
        { type: 'thinking', thinking: 'step two' },
      ],
    };
    expect(extractAnthropicMessageThoughts(payload)).toBe('step one\n\nstep two');
  });

  it('returns undefined when no thinking blocks are present', () => {
    const payload: AnthropicResponsePayload = {
      content: [{ type: 'text', text: 'visible' }],
    };
    expect(extractAnthropicMessageThoughts(payload)).toBeUndefined();
  });

  it('returns undefined when content is absent', () => {
    expect(extractAnthropicMessageThoughts({})).toBeUndefined();
  });

  it('reads error message from JSON body', async () => {
    const response = new Response(JSON.stringify({ error: { message: 'Invalid key' } }), { status: 401 });
    expect(await readResponseErrorMessage(response, 'Anthropic')).toBe('Invalid key');
  });

  it('falls back to status text when body empty', async () => {
    const response = new Response('', { status: 500 });
    const msg = await readResponseErrorMessage(response, 'Anthropic');
    expect(msg).toContain('500');
  });
});
