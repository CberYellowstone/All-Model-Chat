import { describe, expect, it } from 'vitest';
import type { ChatHistoryItem } from '@/types';
import { buildAnthropicRequestBody } from './anthropicMessages';

const history: ChatHistoryItem[] = [
  { role: 'user', parts: [{ text: 'Hello' }] },
  { role: 'model', parts: [{ text: 'Hi there' }] },
];

describe('buildAnthropicRequestBody', () => {
  it('extracts system instruction to top-level system field', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      history,
      [{ text: 'How are you?' }],
      { systemInstruction: 'Be helpful', temperature: 0.5 },
      'user',
      false,
    );
    expect(body.system).toBe('Be helpful');
    expect(body.temperature).toBe(0.5);
  });

  it('maps history roles: model->assistant, user stays user', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      history,
      [{ text: 'How are you?' }],
      {},
      'user',
      false,
    ) as { messages: Array<{ role: string }> };
    const roles = body.messages.map((m) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });

  it('omits system field when no system instruction', () => {
    const body = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', false);
    expect(body.system).toBeUndefined();
  });

  it('includes stream flag and max_tokens', () => {
    const bodyStream = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', true);
    expect(bodyStream.stream).toBe(true);
    expect(bodyStream.max_tokens).toBeGreaterThan(0);
    const bodyNoStream = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', false);
    expect(bodyNoStream.stream).toBe(false);
  });

  it('enables thinking with budget_tokens for non-Fable Claude models', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      [],
      [{ text: 'hi' }],
      { thinkingBudget: 5000 },
      'user',
      false,
    ) as { thinking: { type: string; budget_tokens: number }; max_tokens: number };
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 5000 });
    expect(body.max_tokens).toBe(5000 + 8192);
  });

  it('clamps thinking budget to the Anthropic minimum (1024)', () => {
    const body = buildAnthropicRequestBody(
      'claude-opus-4-8',
      [],
      [{ text: 'hi' }],
      { thinkingBudget: 500 },
      'user',
      false,
    ) as { thinking: { budget_tokens: number } };
    expect(body.thinking.budget_tokens).toBe(1024);
  });

  it('omits thinking for Fable 5 (adaptive thinking is always on)', () => {
    const body = buildAnthropicRequestBody(
      'claude-fable-5',
      [],
      [{ text: 'hi' }],
      { thinkingBudget: 5000 },
      'user',
      false,
    ) as { thinking?: unknown; max_tokens: number };
    expect(body.thinking).toBeUndefined();
    expect(body.max_tokens).toBe(8192);
  });

  it('omits thinking when no thinking budget is set', () => {
    const body = buildAnthropicRequestBody('claude-sonnet-4-6', [], [{ text: 'hi' }], {}, 'user', false) as {
      thinking?: unknown;
    };
    expect(body.thinking).toBeUndefined();
  });
});
