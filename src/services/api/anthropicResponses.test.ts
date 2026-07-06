import { describe, expect, it } from 'vitest';
import { extractAnthropicMessageText } from './anthropicResponses';
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

  it('returns empty string when no content blocks', () => {
    expect(extractAnthropicMessageText({})).toBe('');
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
