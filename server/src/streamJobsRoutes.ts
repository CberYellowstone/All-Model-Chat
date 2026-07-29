// Route prefix for the stream-abort endpoint, kept in its own module so the
// createServer request router can reference it without importing the job store
// (which would pull the AbortController/listener internals into routing).
export const STREAM_ABORT_PREFIX = '/api/gemini/stream-abort';
