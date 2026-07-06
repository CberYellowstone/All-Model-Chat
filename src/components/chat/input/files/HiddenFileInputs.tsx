import React, { type RefObject } from 'react';
import { SUPPORTED_IMAGE_MIME_TYPES, SUPPORTED_UPLOAD_MIME_TYPES } from '@/constants/fileTypeSupport';

interface ChatInputFileInputs {
  fileInputRef: RefObject<HTMLInputElement>;
  imageInputRef: RefObject<HTMLInputElement>;
  folderInputRef: RefObject<HTMLInputElement>;
  zipInputRef: RefObject<HTMLInputElement>;
  cameraInputRef: RefObject<HTMLInputElement>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleZipChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface HiddenFileInputsProps {
  fileInputs: ChatInputFileInputs;
}

export const HiddenFileInputs: React.FC<HiddenFileInputsProps> = ({
  fileInputs: {
    fileInputRef,
    imageInputRef,
    folderInputRef,
    zipInputRef,
    cameraInputRef,
    handleFileChange,
    handleFolderChange,
    handleZipChange,
  },
}) => (
  <>
    <input
      type="file"
      ref={fileInputRef}
      onChange={handleFileChange}
      accept={SUPPORTED_UPLOAD_MIME_TYPES.join(',')}
      className="hidden"
      aria-hidden="true"
      multiple
    />
    <input
      type="file"
      ref={imageInputRef}
      onChange={handleFileChange}
      accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
      className="hidden"
      aria-hidden="true"
      multiple
    />
    <input
      type="file"
      ref={folderInputRef}
      onChange={handleFolderChange}
      className="hidden"
      aria-hidden="true"
      {...({ webkitdirectory: '', directory: '' } as { webkitdirectory: string; directory: string })}
      multiple
    />
    <input
      type="file"
      ref={zipInputRef}
      onChange={handleZipChange}
      accept=".zip"
      className="hidden"
      aria-hidden="true"
    />
    <input
      type="file"
      ref={cameraInputRef}
      onChange={handleFileChange}
      accept="image/*"
      capture="environment"
      className="hidden"
      aria-hidden="true"
    />
  </>
);
