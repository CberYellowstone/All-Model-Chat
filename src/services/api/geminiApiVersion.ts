import type { HttpOptions, Part } from '@google/genai';

export type GeminiClientHttpOptions = Pick<HttpOptions, 'apiVersion' | 'baseUrl' | 'headers' | 'timeout'>;

const MEDIA_RESOLUTION_API_VERSION = 'v1alpha';

const hasPerPartMediaResolution = (parts: Part[] = []): boolean =>
  parts.some((part) => Boolean((part as Part & { mediaResolution?: unknown }).mediaResolution));

export const getHttpOptionsForContents = (contents: Array<{ parts?: Part[] }>): GeminiClientHttpOptions | undefined => {
  if (contents.some((content) => hasPerPartMediaResolution(content.parts))) {
    return { apiVersion: MEDIA_RESOLUTION_API_VERSION };
  }

  return undefined;
};

// Merge an arbitrary set of extra HTTP headers (e.g. the stream-journal
// x-amc-job-id / x-amc-last-seq) into an existing httpOptions object without
// clobbering the apiVersion / baseUrl that media-resolution routing depends on.
export const withHttpOptionHeaders = (
  httpOptions: GeminiClientHttpOptions | undefined,
  headers?: Record<string, string>,
): GeminiClientHttpOptions | undefined => {
  if (!headers || Object.keys(headers).length === 0) {
    return httpOptions;
  }
  return {
    ...(httpOptions ?? {}),
    headers: { ...(httpOptions?.headers ?? {}), ...headers },
  };
};
