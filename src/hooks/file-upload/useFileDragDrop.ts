import { logService } from '@/services/logService';
import { type DragEvent, useState, useCallback } from 'react';
import { type UploadedFile } from '@/types';
import { generateUniqueId } from '@/utils/chat/ids';
import { useI18n } from '@/contexts/I18nContext';
import { createProcessingPlaceholderFile } from '@/utils/file-upload/fileUploadPolicy';

interface UseFileDragDropProps {
  onFilesDropped: (files: FileList | File[]) => Promise<void>;
  onAddTempFile: (file: UploadedFile) => void;
  onRemoveTempFile: (id: string) => void;
}

interface DroppedItemsSnapshot {
  entries: FileSystemEntry[];
  files: File[];
}

const snapshotDroppedItems = (items: DataTransferItemList): DroppedItemsSnapshot => {
  const entries: FileSystemEntry[] = [];
  const files: File[] = [];

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') {
      continue;
    }

    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }

  return { entries, files };
};

export const useFileDragDrop = ({ onFilesDropped, onAddTempFile, onRemoveTempFile }: UseFileDragDropProps) => {
  const { t } = useI18n();
  const [isAppDraggingOver, setIsAppDraggingOver] = useState<boolean>(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState<boolean>(false);

  const handleAppDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsAppDraggingOver(true);
    }
  }, []);

  const handleAppDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy';
        if (!isAppDraggingOver) {
          setIsAppDraggingOver(true);
        }
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    },
    [isAppDraggingOver],
  );

  const handleAppDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if leaving the main container, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsAppDraggingOver(false);
  }, []);

  const handleAppDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsAppDraggingOver(false);
      setIsProcessingDrop(true);

      try {
        const items = e.dataTransfer.items;
        const droppedSnapshot = items ? snapshotDroppedItems(items) : { entries: [], files: [] };
        const hasDirectory = droppedSnapshot.entries.some((entry) => entry.isDirectory);

        if (hasDirectory) {
          const tempId = generateUniqueId();
          onAddTempFile(
            createProcessingPlaceholderFile({
              id: tempId,
              name: t('fileProcessing_dropped'),
              type: 'application/x-directory', // Dummy type for icon
              size: 0,
            }),
          );

          const [{ processDroppedItemsSnapshot }, { buildImportContextFile }] = await Promise.all([
            import('@/utils/import-context/droppedItems'),
            import('@/utils/import-context/importContextBuilder'),
          ]);
          const dropped = await processDroppedItemsSnapshot(droppedSnapshot);

          if (dropped.files.length > 0 || dropped.emptyDirectoryPaths.length > 0) {
            const contextFile = await buildImportContextFile(dropped.files, {
              emptyDirectoryPaths: dropped.emptyDirectoryPaths,
            });
            await onFilesDropped([contextFile]);
          }

          onRemoveTempFile(tempId);
        } else {
          // Standard file drop
          const files = e.dataTransfer.files;
          if (files?.length) {
            await onFilesDropped(files);
          }
        }
      } catch (error) {
        logService.error('Error processing dropped files:', error);
      } finally {
        setIsProcessingDrop(false);
      }
    },
    [onFilesDropped, onAddTempFile, onRemoveTempFile, t],
  );

  return {
    isAppDraggingOver,
    isProcessingDrop,
    handleAppDragEnter,
    handleAppDragOver,
    handleAppDragLeave,
    handleAppDrop,
  };
};
