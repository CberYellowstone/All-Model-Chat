// Schedule a callback on the next macrotask so pending React state commits or DOM mutations apply first.
export const deferToNextTick = (callback: () => void): ReturnType<typeof setTimeout> => setTimeout(callback, 0);
