import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import type { ImageOutputMode } from '@/types';
import { ToolbarSegmentedControl } from './ToolbarSegmentedControl';

interface ImageOutputModeSelectorProps {
  imageOutputMode: ImageOutputMode;
  setImageOutputMode: (mode: ImageOutputMode) => void;
}

export const ImageOutputModeSelector: React.FC<ImageOutputModeSelectorProps> = ({
  imageOutputMode,
  setImageOutputMode,
}) => {
  const { t } = useI18n();

  return (
    <ToolbarSegmentedControl<ImageOutputMode>
      aria-label={t('imageOutputModeTitle')}
      value={imageOutputMode}
      onChange={setImageOutputMode}
      options={[
        {
          value: 'IMAGE_TEXT',
          label: t('imageOutputModeTextAndImage'),
          title: t('imageOutputModeTextAndImage'),
        },
        {
          value: 'IMAGE_ONLY',
          label: t('imageOutputModeImageOnly'),
          title: t('imageOutputModeImageOnly'),
        },
      ]}
    />
  );
};
