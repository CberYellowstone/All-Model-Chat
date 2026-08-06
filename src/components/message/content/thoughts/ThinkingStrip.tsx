import React from 'react';
import { THINKING_STRIP_CONTENT_HEIGHT_REM } from './thinkingStripMetrics';

interface ThinkingStripProps {
  /** Plain-text tail of the active thought stream (heading markers already stripped). */
  thoughtsTail: string;
}

/**
 * Fixed 5-line, bottom-anchored preview of the active thinking stream.
 *
 * The viewport is exactly 5 text lines tall (fixed pixel height — line-clamp
 * would only cap the maximum and lets short content shrink). `flex-col-reverse`
 * pins the visible window to the newest line as content grows, with no scroll
 * math; users can scroll up to review earlier lines. There is no title row:
 * third-party providers stream flat reasoning text with no headings, so the
 * title slot previously rendered a meaningless fallback label.
 */
export const ThinkingStrip: React.FC<ThinkingStripProps> = ({ thoughtsTail }) => {
  if (!thoughtsTail) {
    return null;
  }

  return (
    <div
      data-thinking-strip="true"
      className="mx-3 mb-2 mt-1 flex rounded-md border border-[var(--theme-border-secondary)]/50 border-l-[3px] border-l-[var(--theme-text-success)] bg-[var(--theme-bg-input)]/50 p-2"
    >
      <div
        data-thinking-strip-viewport="true"
        className="flex min-w-0 flex-1 flex-col-reverse overflow-y-auto custom-scrollbar"
        style={{ height: `${THINKING_STRIP_CONTENT_HEIGHT_REM}rem` }}
      >
        <span className="whitespace-pre-wrap break-words text-xs leading-[1.25rem] text-[var(--theme-text-tertiary)]">
          {thoughtsTail}
        </span>
      </div>
    </div>
  );
};
