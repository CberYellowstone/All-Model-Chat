export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Reads an error message from an HTTP response body. Tries `{ error: { message } }`
 * (Anthropic / OpenAI-compatible shape), then `{ error: string }` (MCP shape),
 * falling back to the raw body, then to a status-only summary. Used by every
 * provider API client + the MCP client — keep the fallback ladder intact.
 */
export const readResponseErrorMessage = async (response: Response, fallbackLabel: string): Promise<string> => {
  const text = await response.text();
  if (!text) {
    return `${fallbackLabel} failed with status ${response.status}`;
  }
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string };
    const error = parsed.error;
    if (typeof error === 'string') return error || text;
    if (error && typeof error.message === 'string') return error.message;
    return text;
  } catch {
    return text;
  }
};
