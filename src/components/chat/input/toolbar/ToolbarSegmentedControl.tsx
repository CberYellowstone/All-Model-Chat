import React from 'react';
import {
  TOOLBAR_SEGMENT_ACTIVE_CLASS,
  TOOLBAR_SEGMENT_IDLE_CLASS,
  TOOLBAR_SEGMENTED_TRACK_CLASS,
} from '@/constants/designTokens';

interface ToolbarSegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  title?: string;
  'aria-label'?: string;
}

interface ToolbarSegmentedControlProps<T extends string> {
  value: T;
  options: ToolbarSegmentOption<T>[];
  onChange: (value: T) => void;
  'aria-label'?: string;
  className?: string;
}

export function ToolbarSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: ToolbarSegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={[TOOLBAR_SEGMENTED_TRACK_CLASS, className].filter(Boolean).join(' ')}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option['aria-label'] ?? option.title}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={isSelected ? TOOLBAR_SEGMENT_ACTIVE_CLASS : TOOLBAR_SEGMENT_IDLE_CLASS}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
