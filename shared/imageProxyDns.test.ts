// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { assertImageProxyHostResolvesPublic, type ImageProxyDnsLookup } from './imageProxyDns.js';

describe('assertImageProxyHostResolvesPublic', () => {
  it('rejects private IP literals without DNS', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>();

    await expect(assertImageProxyHostResolvesPublic(new URL('http://127.0.0.1/x'), lookup)).rejects.toThrow(
      /private network host/,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('allows public IP literals without DNS', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>();

    await expect(assertImageProxyHostResolvesPublic(new URL('https://8.8.8.8/a.png'), lookup)).resolves.toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects hostnames that resolve to private addresses (DNS rebinding)', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>().mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(
      assertImageProxyHostResolvesPublic(new URL('https://evil.example.com/img.png'), lookup),
    ).rejects.toThrow(/resolves to private address 127\.0\.0\.1/);
    expect(lookup).toHaveBeenCalledWith('evil.example.com', { all: true, verbatim: true });
  });

  it('allows hostnames that resolve only to public addresses', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>().mockResolvedValue([{ address: '1.2.3.4', family: 4 }]);

    await expect(
      assertImageProxyHostResolvesPublic(new URL('https://cdn.example.com/a.png'), lookup),
    ).resolves.toBeUndefined();
  });

  it('rejects when any resolved address is private', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>().mockResolvedValue([
      { address: '1.2.3.4', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);

    await expect(assertImageProxyHostResolvesPublic(new URL('https://dual.example.com/a.png'), lookup)).rejects.toThrow(
      /10\.0\.0\.1/,
    );
  });

  it('rejects DNS resolution failures', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>().mockRejectedValue(new Error('ENOTFOUND'));

    await expect(
      assertImageProxyHostResolvesPublic(new URL('https://missing.example.com/a.png'), lookup),
    ).rejects.toThrow(/Failed to resolve image proxy host "missing\.example\.com"/);
  });

  it('rejects credentialed URLs', async () => {
    const lookup = vi.fn<ImageProxyDnsLookup>();

    await expect(
      assertImageProxyHostResolvesPublic(new URL('https://user:pass@cdn.example.com/a.png'), lookup),
    ).rejects.toThrow(/credentials/);
    expect(lookup).not.toHaveBeenCalled();
  });
});
