// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpServerCleanup, startHttpServer } from '../test/httpServer';
import { createServer } from './createServer';
import { resolveUpstream } from './liveWsProxy';
import type { ApiServerConfig } from './config';

const serverCleanup = createHttpServerCleanup();

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  await serverCleanup.cleanup();
  vi.restoreAllMocks();
});

const buildConfig = (overrides: Partial<ApiServerConfig> = {}): ApiServerConfig => ({
  port: 3001,
  geminiApiBase: 'https://generativelanguage.googleapis.com',
  geminiApiKey: undefined,
  allowedOrigins: [],
  enableMcpStdio: false,
  enableMcpPrivateHttp: false,
  enableLiveWsProxy: true,
  liveWsIdleTimeoutMs: 300_000,
  serverKeyPriority: false,
  thirdPartyRoutes: {},
  ...overrides,
});

describe('Live WS proxy health + capability bits', () => {
  it('reports Live WS + third-party proxy capability bits on /health', async () => {
    const app = createServer(buildConfig({ thirdPartyRoutes: { openai: { baseUrl: 'https://api.openai.com/v1' } } }));
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/health`);
    const body = (await response.json()) as { capabilities?: { liveWsProxy?: boolean; thirdPartyProxy?: boolean } };

    expect(response.status).toBe(200);
    expect(body.capabilities?.liveWsProxy).toBe(true);
    expect(body.capabilities?.thirdPartyProxy).toBe(true);
  });

  it('reports the third-party proxy disabled when no routes are configured', async () => {
    const app = createServer(buildConfig());
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/health`);
    const body = (await response.json()) as { capabilities?: { thirdPartyProxy?: boolean } };

    expect(body.capabilities?.thirdPartyProxy).toBe(false);
  });
});

describe('resolveUpstream (BYOK 兜底 unit)', () => {
  it('keeps a real browser key and flags it as BYOK', () => {
    const result = resolveUpstream(new URL('http://localhost/api/live?key=byok-key'), 'host', 'server-key');
    expect(result?.hadBrowserKey).toBe(true);
    expect(result?.url).toContain('key=byok-key');
  });

  it('swaps the sentinel for the server-managed key', () => {
    const result = resolveUpstream(
      new URL('http://localhost/api/live?key=__SERVER_MANAGED_API_KEY__'),
      'host',
      'server-key',
    );
    expect(result?.hadBrowserKey).toBe(false);
    expect(result?.url).toContain('key=server-key');
  });

  it('returns null when no browser key and no server key are present', () => {
    expect(resolveUpstream(new URL('http://localhost/api/live'), 'host', undefined)).toBeNull();
    expect(
      resolveUpstream(new URL('http://localhost/api/live?key=__SERVER_MANAGED_API_KEY__'), 'host', undefined),
    ).toBeNull();
  });

  it('handles access_token (ephemeral token) auth the same way', () => {
    const result = resolveUpstream(
      new URL('http://localhost/api/live?access_token=__SERVER_MANAGED_API_KEY__'),
      'host',
      'server-key',
    );
    expect(result?.hadBrowserKey).toBe(false);
    expect(result?.url).toContain('access_token=server-key');
  });
});
