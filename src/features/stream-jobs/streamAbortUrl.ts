// Relative URL of the api container's stream-abort endpoint. Kept in its own
// module so callers (the stop handler, tests) can reference it without pulling
// the fetch wrapper.
export const STREAM_ABORT_URL_PREFIX = '/api/gemini/stream-abort';
