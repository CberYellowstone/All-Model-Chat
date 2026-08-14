// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ImageProxyDnsLookup } from './imageProxyDns.js';
import { fetchImageProxyWithSafeRedirects, isUnsafeImageProxyRedirect } from './imageProxyFetch.js';

const publicLookup: ImageProxyDnsLookup = async () => [{ address: '1.2.3.4', family: 4 }];

describe('isUnsafeImageProxyRedirect', () => {
  it('blocks private and link-local hosts', () => {
    expect(isUnsafeImageProxyRedirect(new URL('http://127.0.0.1/x'))).toBe(true);
    expect(isUnsafeImageProxyRedirect(new URL('http://169.254.169.254/latest'))).toBe(true);
    expect(isUnsafeImageProxyRedirect(new URL('http://192.168.1.1/img'))).toBe(true);
  });

  it('blocks credentialed URLs', () => {
    expect(isUnsafeImageProxyRedirect(new URL('https://user:pass@cdn.example.com/a.png'))).toBe(true);
  });

  it('allows public hosts without credentials', () => {
    expect(isUnsafeImageProxyRedirect(new URL('https://cdn.example.com/a.png'))).toBe(false);
  });
});

describe('fetchImageProxyWithSafeRedirects', () => {
  it('follows a safe public redirect and returns the final response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.com/final.png' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      );

    const result = await fetchImageProxyWithSafeRedirects(new URL('https://cdn.example.com/signed'), {
      fetchImpl: fetchImpl as typeof fetch,
      lookup: publicLookup,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('rejects redirects that land on a private address', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      }),
    );

    const result = await fetchImageProxyWithSafeRedirects(new URL('https://cdn.example.com/redirect'), {
      fetchImpl: fetchImpl as typeof fetch,
      lookup: publicLookup,
    });

    expect(result).toEqual({ ok: false, kind: 'unsafe_redirect' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('blocks hostnames that resolve to private IPs before fetching (DNS rebinding)', async () => {
    const fetchImpl = vi.fn();
    const lookup = vi.fn<ImageProxyDnsLookup>().mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    const result = await fetchImageProxyWithSafeRedirects(new URL('https://evil.example.com/a.png'), {
      fetchImpl: fetchImpl as typeof fetch,
      lookup,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('blocked');
    if (result.kind !== 'blocked') return;
    expect(result.message).toMatch(/resolves to private address 127\.0\.0\.1/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('re-resolves redirect hop hostnames and blocks private resolution', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://rebinder.example.com/secret' },
      }),
    );
    const lookup = vi.fn<ImageProxyDnsLookup>().mockImplementation(async (hostname) => {
      if (hostname === 'cdn.example.com') {
        return [{ address: '1.2.3.4', family: 4 }];
      }
      if (hostname === 'rebinder.example.com') {
        return [{ address: '169.254.169.254', family: 4 }];
      }
      throw new Error(`unexpected ${hostname}`);
    });

    const result = await fetchImageProxyWithSafeRedirects(new URL('https://cdn.example.com/redirect'), {
      fetchImpl: fetchImpl as typeof fetch,
      lookup,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('blocked');
    if (result.kind !== 'blocked') return;
    expect(result.message).toMatch(/rebinder\.example\.com.*169\.254\.169\.254/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns fetch_error when the upstream request throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));

    const result = await fetchImageProxyWithSafeRedirects(new URL('https://cdn.example.com/a.png'), {
      fetchImpl: fetchImpl as typeof fetch,
      lookup: publicLookup,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('fetch_error');
  });
});
