import React from 'react';
import { FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS } from '@/constants/focusClasses';

interface ImageSizeSelectorProps {
  imageSize: string;
  setImageSize: (size: string) => void;
  supportedSizes?: string[];
}

export const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({ imageSize, setImageSize, supportedSizes }) => {
  const sizes = supportedSizes || [];
  if (sizes.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-x-2">
        {sizes.map((sizeValue) => {
          const isSelected = imageSize === sizeValue;
          return (
            <button
              key={sizeValue}
              onClick={() => setImageSize(sizeValue)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS} ${isSelected ? 'bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] border border-[var(--theme-border-secondary)]' : 'text-[var(--theme-text-tertiary)] hover:bg-[var(--theme-bg-secondary)]/50'}`}
              title={`Set resolution to ${sizeValue}`}
            >
              {sizeValue}
            </button>
          );
        })}
      </div>
    </div>
  );
};
