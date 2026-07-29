import type { AppSettings } from '@/types';
import { DEFAULT_GEMINI_API_BASE_URL, normalizeGeminiApiBaseUrl } from '@/utils/apiProxyUrl';
import { getLiveApiProxyBaseUrl } from '@/runtime/runtimeConfig';

type GeminiApiBaseUrlSettings = Pick<AppSettings, 'useCustomApiConfig' | 'useApiProxy' | 'apiProxyUrl'>;

export const resolveConfiguredGeminiBaseUrl = (appSettings: GeminiApiBaseUrlSettings): string | null => {
  const shouldUseProxy = !!(appSettings.useCustomApiConfig && appSettings.useApiProxy);
  return shouldUseProxy ? (appSettings.apiProxyUrl ?? null) : null;
};

const isAbsoluteHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url.trim());

/**
 * Whether the configured Gemini base URL is a relative path (e.g. the Docker
 * default "/api/gemini"). Only in that case do browser requests traverse our
 * own api container, where the stream-journal lives — so only then is it
 * worth stamping x-amc-job-id for resume. Absolute proxy URLs (e.g.
 * "https://api-proxy.de/gemini") bypass the api container, so journaling is a
 * no-op there and we skip the header.
 */
export const isGeminiProxyRelativePath = (appSettings: GeminiApiBaseUrlSettings): boolean => {
  const configured = resolveConfiguredGeminiBaseUrl(appSettings);
  return Boolean(configured) && !isAbsoluteHttpUrl(configured as string);
};

export const getGeminiApiBaseUrlForSettings = (settings?: GeminiApiBaseUrlSettings | null): string => {
  const configuredBaseUrl = settings ? resolveConfiguredGeminiBaseUrl(settings) : null;
  return normalizeGeminiApiBaseUrl(configuredBaseUrl ?? DEFAULT_GEMINI_API_BASE_URL);
};

export const getGeminiProxyBaseUrlForSettings = (settings?: GeminiApiBaseUrlSettings | null): string | null => {
  const configuredBaseUrl = settings ? resolveConfiguredGeminiBaseUrl(settings) : null;
  return configuredBaseUrl ? normalizeGeminiApiBaseUrl(configuredBaseUrl) : null;
};

// Resolve a relative frontend path (e.g. "/api/live") injected by the Docker
// web container into an absolute http(s) URL against the current origin. The
// @google/genai SDK converts http→ws / https→wss itself in getWebsocketBaseUrl,
// so we hand it an HTTP(S) URL rather than a pre-converted ws(s):// one.
const toAbsoluteHttpUrl = (httpUrl: string): string => {
  const trimmed = httpUrl.trim();
  if (isAbsoluteHttpUrl(trimmed)) {
    return trimmed;
  }
  if (typeof window !== 'undefined') {
    return new URL(trimmed, window.location.origin).toString();
  }
  return trimmed;
};

export const resolveLiveClientBaseUrl = (appSettings: GeminiApiBaseUrlSettings): string | null => {
  // Docker runtime injection takes precedence: a relative /api/live path means
  // the api container terminates the WS upgrade and bridges to the upstream.
  const runtimeProxy = getLiveApiProxyBaseUrl();
  if (runtimeProxy) {
    return toAbsoluteHttpUrl(runtimeProxy);
  }

  const configuredBaseUrl = resolveConfiguredGeminiBaseUrl(appSettings);
  if (!configuredBaseUrl) {
    return null;
  }

  const normalizedConfiguredBaseUrl = normalizeGeminiApiBaseUrl(configuredBaseUrl);
  return isAbsoluteHttpUrl(normalizedConfiguredBaseUrl) ? normalizedConfiguredBaseUrl : null;
};
