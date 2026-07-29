import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { ApiServerConfig } from './config.js';

// Sentinel the browser sends when Live should use the server-managed key
// (mirrors src/utils/apiKeySelection.SERVER_MANAGED_API_KEY — duplicated here
// because the server bundle does not import from src/).
const SERVER_MANAGED_API_KEY_SENTINEL = '__SERVER_MANAGED_API_KEY__';

const LIVE_WS_PATH_PREFIX = '/api/live';
const UPSTREAM_WS_HOST = 'generativelanguage.googleapis.com';
const MAX_MESSAGE_BYTES = 4 * 1024 * 1024;

interface LiveWsProxyConfig {
  enableLiveWsProxy: boolean;
  liveWsIdleTimeoutMs: number;
  geminiApiKey?: string;
}

// Log only non-secret context. The key and full upstream URL are never printed.
const logLiveEvent = (event: string, context: Record<string, unknown> = {}) => {
  console.log(`[live-ws] ${event}`, context);
};

const resolveLiveWsProxyConfig = (config: ApiServerConfig): LiveWsProxyConfig => ({
  enableLiveWsProxy: config.enableLiveWsProxy,
  liveWsIdleTimeoutMs: config.liveWsIdleTimeoutMs,
  geminiApiKey: config.geminiApiKey,
});

const isPathHandled = (request: IncomingMessage): boolean => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  return requestUrl.pathname === LIVE_WS_PATH_PREFIX || requestUrl.pathname.startsWith(`${LIVE_WS_PATH_PREFIX}/`);
};

interface ResolvedUpstream {
  url: string;
  hadBrowserKey: boolean;
}

// Key priority (BYOK 兜底): a real browser key wins; the sentinel or a missing
// key falls back to the server-managed GEMINI_API_KEY.
export const resolveUpstream = (
  requestUrl: URL,
  upstreamHost: string,
  serverApiKey?: string,
): ResolvedUpstream | null => {
  const restPath = requestUrl.pathname.slice(LIVE_WS_PATH_PREFIX.length) || '/';
  const searchParams = new URLSearchParams(requestUrl.searchParams);

  const queryKey = searchParams.get('key') ?? '';
  const accessToken = searchParams.get('access_token') ?? '';

  let resolvedKey: string;
  let hadBrowserKey = false;

  if (queryKey && queryKey !== SERVER_MANAGED_API_KEY_SENTINEL) {
    resolvedKey = queryKey;
    hadBrowserKey = true;
  } else if (accessToken && accessToken !== SERVER_MANAGED_API_KEY_SENTINEL) {
    resolvedKey = accessToken;
    hadBrowserKey = true;
  } else {
    const serverKey = serverApiKey?.trim();
    if (!serverKey) {
      return null;
    }
    resolvedKey = serverKey;
  }

  // Overwrite the auth param with the resolved key (swaps the sentinel for the
  // real server key, or re-stamps a BYOK key).
  if (searchParams.has('access_token')) {
    searchParams.set('access_token', resolvedKey);
  } else {
    searchParams.set('key', resolvedKey);
  }

  const upstreamUrl = `wss://${upstreamHost}${restPath}?${searchParams.toString()}`;
  return { url: upstreamUrl, hadBrowserKey };
};

const closeBoth = (a: WebSocket, b: WebSocket | null, code: number, reason: string) => {
  try {
    if (b && b.readyState === WebSocket.OPEN) b.close(code, reason);
  } catch {
    // ignore
  }
  try {
    if (a.readyState === WebSocket.OPEN) a.close(code, reason);
  } catch {
    // ignore
  }
};

const bridge = (clientWs: WebSocket, request: IncomingMessage, upstreamHost: string, config: LiveWsProxyConfig) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const resolved = resolveUpstream(requestUrl, upstreamHost, config.geminiApiKey);
  if (!resolved) {
    logLiveEvent('rejected', { reason: 'no-api-key' });
    clientWs.close(1011, 'Live API key not configured');
    return;
  }

  logLiveEvent('connecting', { byok: resolved.hadBrowserKey });

  const upstreamWs = new WebSocket(resolved.url, {
    maxPayload: MAX_MESSAGE_BYTES,
    // The upstream is a fixed public Google host; do not let redirects or
    // per-message headers leak the resolved key.
    perMessageDeflate: false,
  });

  let settled = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      logLiveEvent('idle-timeout');
      closeBoth(clientWs, upstreamWs, 1001, 'Idle timeout');
    }, config.liveWsIdleTimeoutMs);
    // Don't keep the event loop alive solely for the idle timer.
    idleTimer.unref?.();
  };

  const teardown = (reason: string) => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (!settled) {
      settled = true;
      logLiveEvent('closed', { reason });
    }
  };

  upstreamWs.on('open', () => {
    if (clientWs.readyState !== WebSocket.OPEN) {
      upstreamWs.close(1001, 'client gone');
      return;
    }
    resetIdle();
  });

  // client -> upstream
  clientWs.on('message', (data, isBinary) => {
    if (upstreamWs.readyState !== WebSocket.OPEN) return;
    resetIdle();
    upstreamWs.send(data, { binary: isBinary });
  });

  // upstream -> client
  upstreamWs.on('message', (data, isBinary) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    resetIdle();
    clientWs.send(data, { binary: isBinary });
  });

  const forwardClose = (source: 'client' | 'upstream', ws: WebSocket, other: WebSocket | null) => {
    ws.on('close', (code, reasonBuf) => {
      teardown(`${source}-close`);
      if (other && other.readyState === WebSocket.OPEN) {
        const reason = reasonBuf?.toString('utf8') ?? '';
        try {
          other.close(code || 1000, reason || undefined);
        } catch {
          other.close();
        }
      }
    });
    ws.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      teardown(`${source}-error`);
      logLiveEvent(`${source}-error`, { message });
      closeBoth(clientWs, upstreamWs, 1011, 'WebSocket error');
    });
  };

  forwardClose('client', clientWs, upstreamWs);
  forwardClose('upstream', upstreamWs, clientWs);

  // If the upstream never opens, surface a failure to the client.
  upstreamWs.on('unexpected-response', (_req, res) => {
    teardown('upstream-rejected');
    logLiveEvent('upstream-rejected', { status: res.statusCode });
    closeBoth(clientWs, upstreamWs, 1011, 'Upstream rejected upgrade');
  });
};

export function attachLiveWsUpgrade(server: Server, config: ApiServerConfig): void {
  const liveConfig = resolveLiveWsProxyConfig(config);

  if (!liveConfig.enableLiveWsProxy) {
    // Still own the path so unconfigured upgrades don't hang; reject firmly.
    server.on('upgrade', (request, socket) => {
      if (!isPathHandled(request)) return;
      socket.destroy();
    });
    return;
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  server.on('upgrade', (request, socket, head) => {
    if (!isPathHandled(request)) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (clientWs) => {
      bridge(clientWs, request, UPSTREAM_WS_HOST, liveConfig);
    });
  });
}
