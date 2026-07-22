import { isPrivateNetworkHostname } from './privateNetwork.js';

/**
 * Parse and allowlist an image-proxy target URL. Rejects non-http(s), credentials,
 * and private/local hostnames. Shared by production (`server`) and Vite dev plugin.
 */
export const parseAllowedImageProxyUrl = (value: string | null): URL | null => {
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }
    if (parsedUrl.username || parsedUrl.password || isPrivateNetworkHostname(parsedUrl.hostname)) {
      return null;
    }
    return parsedUrl;
  } catch {
    return null;
  }
};
