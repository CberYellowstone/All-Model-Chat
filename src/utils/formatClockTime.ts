export const formatClockTime = (seconds: number): string => {
  if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
