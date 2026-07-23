import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { ToolbarSegmentedControl } from './ToolbarSegmentedControl';

interface ImageSizeSelectorProps {
  imageSize: string;
  setImageSize: (size: string) => void;
  supportedSizes?: string[];
}

export const ImageSizeSelector: React.FC<ImageSizeSelectorProps> = ({ imageSize, setImageSize, supportedSizes }) => {
  const { t } = useI18n();
  const sizes = supportedSizes || [];
  // Single fixed size is not a choice — hide the control.
  if (sizes.length <= 1) return null;

  return (
    <ToolbarSegmentedControl
      aria-label={t('imageSizeTitle')}
      value={imageSize}
      onChange={setImageSize}
      options={sizes.map((sizeValue) => ({
        value: sizeValue,
        label: sizeValue,
        title: `${t('imageSizeSetTitle')} ${sizeValue}`,
        'aria-label': `${t('imageSizeSetTitle')} ${sizeValue}`,
      }))}
    />
  );
};
