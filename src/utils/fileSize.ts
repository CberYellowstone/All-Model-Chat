const FILE_SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];

export const formatFileSize = (sizeInBytes: number): string => {
  if (!sizeInBytes) return '';
  if (sizeInBytes < 1024) return `${Math.round(sizeInBytes)} B`;

  let value = sizeInBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 1 : 2;
  return `${value.toFixed(decimals)} ${FILE_SIZE_UNITS[unitIndex]}`;
};
