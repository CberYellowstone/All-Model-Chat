import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Sparkles } from 'lucide-react';
import { Select } from '@/components/shared/Select';

const AspectRatioIcon = ({ ratio, className }: { ratio: string; className?: string }) => {
  if (ratio === 'Auto') {
    return <Sparkles size={14} className={className} strokeWidth={2} />;
  }
  let styles: React.CSSProperties;
  switch (ratio) {
    case '1:1':
      styles = { width: '14px', height: '14px' };
      break;
    case '1:4':
      styles = { width: '6px', height: '18px' };
      break;
    case '1:8':
      styles = { width: '5px', height: '18px' };
      break;
    case '9:16':
      styles = { width: '9px', height: '16px' };
      break;
    case '16:9':
      styles = { width: '18px', height: '10px' };
      break;
    case '4:1':
      styles = { width: '18px', height: '6px' };
      break;
    case '4:3':
      styles = { width: '16px', height: '12px' };
      break;
    case '3:4':
      styles = { width: '12px', height: '16px' };
      break;
    case '2:3':
      styles = { width: '11px', height: '16px' };
      break;
    case '3:2':
      styles = { width: '16px', height: '11px' };
      break;
    case '4:5':
      styles = { width: '12px', height: '15px' };
      break;
    case '5:4':
      styles = { width: '15px', height: '12px' };
      break;
    case '8:1':
      styles = { width: '18px', height: '5px' };
      break;
    case '21:9':
      styles = { width: '18px', height: '8px' };
      break;
    default:
      styles = { width: '14px', height: '14px' };
      break;
  }
  return <div style={styles} className={`border-2 border-current rounded-[2px] flex-shrink-0 ${className || ''}`} />;
};

const defaultAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '4:5', '5:4', '21:9'];

interface AspectRatioSelectorProps {
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  supportedRatios?: string[];
}

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  aspectRatio,
  setAspectRatio,
  supportedRatios,
}) => {
  const { t } = useI18n();
  const ratios = supportedRatios || defaultAspectRatios;

  return (
    <Select
      id="aspect-ratio-selector"
      label={t('aspectRatioTitle')}
      hideLabel
      value={aspectRatio}
      onChange={(e) => setAspectRatio(e.target.value)}
      className="mb-0"
      wrapperClassName="relative w-[7.25rem]"
      dropdownClassName="min-w-[9rem] max-h-[280px]"
      direction="up"
      size="compact"
    >
      {ratios.map((ratio) => (
        <option key={ratio} value={ratio}>
          <div className="flex items-center gap-2">
            <AspectRatioIcon ratio={ratio} className="text-[var(--theme-text-secondary)]" />
            <span>{ratio}</span>
          </div>
        </option>
      ))}
    </Select>
  );
};
