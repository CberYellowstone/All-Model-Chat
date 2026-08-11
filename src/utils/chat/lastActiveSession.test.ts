import { describe, expect, it } from 'vitest';

import { buildNewTabHref } from './lastActiveSession';

describe('buildNewTabHref', () => {
  it('encodes the active session id into a ?from query param', () => {
    expect(buildNewTabHref('chat-abc')).toBe('/?from=chat-abc');
  });

  it('returns the bare root path when there is no active session', () => {
    expect(buildNewTabHref(null)).toBe('/');
  });

  it('encodes special characters in the session id', () => {
    expect(buildNewTabHref('a b/c?d')).toBe('/?from=a%20b%2Fc%3Fd');
  });
});
