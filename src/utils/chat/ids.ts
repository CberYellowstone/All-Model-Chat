// Use crypto.randomUUID when available for collision-free IDs; fall back to the
// legacy timestamp+random scheme only in environments without it (older runtimes/tests).
export const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `chat-${crypto.randomUUID()}`;
  }
  return `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};
