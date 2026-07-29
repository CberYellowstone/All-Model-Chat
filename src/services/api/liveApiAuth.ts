import type { GoogleGenAI } from '@google/genai';
import type { AppSettings } from '@/types';
import { getClient } from './apiClient';
import { SERVER_MANAGED_API_KEY } from '@/utils/apiKeySelection';
import { resolveLiveClientBaseUrl } from './geminiApiBaseUrl';
import type { GeminiClientHttpOptions } from './geminiApiVersion';

export class LiveApiAuthConfigurationError extends Error {
  code: 'MISSING_API_KEY';

  constructor(code: 'MISSING_API_KEY', message: string) {
    super(message);
    this.name = 'LiveApiAuthConfigurationError';
    this.code = code;
  }
}

export const getLiveApiClient = async (
  appSettings: Pick<AppSettings, 'useCustomApiConfig' | 'useApiProxy' | 'apiProxyUrl'>,
  httpOptions?: GeminiClientHttpOptions,
  apiKeyForLiveConnection?: string | null,
): Promise<GoogleGenAI> => {
  const proxyBaseUrl = resolveLiveClientBaseUrl(appSettings);
  const apiKey = apiKeyForLiveConnection?.trim();

  if (!apiKey) {
    // No browser key. If the Docker WS proxy is configured, hand the api
    // container the server-managed sentinel; it swaps in the real server key
    // (BYOK 兜底). Without the proxy there is nowhere to swap, so bail.
    if (proxyBaseUrl) {
      return getClient(SERVER_MANAGED_API_KEY, proxyBaseUrl, httpOptions);
    }
    throw new LiveApiAuthConfigurationError('MISSING_API_KEY', 'Live API requires a browser API key.');
  }

  return getClient(apiKey, proxyBaseUrl, httpOptions);
};
