import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderHookWithProviders } from '@/test/providerTestUtils';
import { useFileDragDrop } from './useFileDragDrop';

function createFileEntry(fullPath: string, file: File): FileSystemFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    fullPath,
    file(successCallback: (value: File) => void) {
      successCallback(file);
    },
  } as unknown as FileSystemFileEntry;
}

function createDirectoryEntry(name: string, fullPath: string, children: FileSystemEntry[]): FileSystemDirectoryEntry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    fullPath,
    createReader() {
      let consumed = false;
      return {
        readEntries(successCallback) {
          if (consumed) {
            successCallback([]);
            return;
          }

          consumed = true;
          successCallback(children);
        },
      } as FileSystemDirectoryReader;
    },
  } as unknown as FileSystemDirectoryEntry;
}

function createDropEvent(dataTransfer: Partial<DataTransfer>): React.DragEvent<HTMLDivElement> {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer,
  } as unknown as React.DragEvent<HTMLDivElement>;
}

describe('useFileDragDrop', () => {
  it('snapshots dropped directory entries before async processing begins', async () => {
    const appFile = new File(['export const app = true;\n'], 'app.ts', { type: 'text/plain' });
    const rootEntry = createDirectoryEntry('demo', '/demo', [createFileEntry('/demo/src/app.ts', appFile)]);
    const item = {
      kind: 'file',
      webkitGetAsEntry: vi.fn().mockReturnValueOnce(rootEntry).mockReturnValueOnce(null),
      getAsFile: () => null,
    };
    const onFilesDropped = vi.fn<(_files: FileList | File[]) => Promise<void>>(async () => {});
    const { result, unmount } = renderHookWithProviders(
      () =>
        useFileDragDrop({
          onFilesDropped,
          onAddTempFile: vi.fn(),
          onRemoveTempFile: vi.fn(),
        }),
      { language: 'en' },
    );

    await act(async () => {
      await result.current.handleAppDrop(
        createDropEvent({
          items: [item] as unknown as DataTransferItemList,
          files: [] as unknown as FileList,
        }),
      );
    });

    expect(onFilesDropped).toHaveBeenCalledTimes(1);
    const droppedFiles = onFilesDropped.mock.calls[0]?.[0];
    const contextFile = droppedFiles[0];
    expect(contextFile).toBeInstanceOf(File);
    await expect(contextFile.text()).resolves.toContain('export const app = true;');

    unmount();
  });
});
