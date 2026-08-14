import { logService } from '@/services/logService';
import { useEffect, useState } from 'react';
import { dbService, type AppDataSizeEstimate } from '@/services/db/dbService';
import { formatFileSize } from '@/utils/file/fileSize';

interface AppDataSizeState {
  estimate: AppDataSizeEstimate | null;
  isLoading: boolean;
  hasError: boolean;
  formattedTotalSize: string;
  refresh: () => Promise<void>;
}

export const useAppDataSize = (): AppDataSizeState => {
  const [estimate, setEstimate] = useState<AppDataSizeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const nextEstimate = await dbService.estimateAppDataSize();
      setEstimate(nextEstimate);
    } catch (error) {
      logService.error('Failed to estimate app data size:', error);
      setEstimate(null);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    estimate,
    isLoading,
    hasError,
    formattedTotalSize: estimate?.totalBytes ? formatFileSize(estimate.totalBytes) : '0 B',
    refresh,
  };
};
