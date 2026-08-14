import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface VirtualSourceViewerProps {
  content: string;
  highlightLine?: number | null;
  onHighlightLineConsumed?: () => void;
  className?: string;
}

const ROW_HEIGHT_PX = 21;
const GUTTER_WIDTH_PX = 56;
const VERTICAL_PADDING_PX = 24;
const VIRTUALIZATION_OVERSCAN_ROWS = 20;

export const VirtualSourceViewer: React.FC<VirtualSourceViewerProps> = ({
  content,
  highlightLine = null,
  onHighlightLineConsumed,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const lines = useMemo(() => content.split(/\r\n|\r|\n/), [content]);
  const totalHeight = lines.length * ROW_HEIGHT_PX + VERTICAL_PADDING_PX * 2;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (highlightLine === null || highlightLine < 0 || !containerRef.current) return;

    const targetScrollTop = Math.max(0, highlightLine * ROW_HEIGHT_PX - viewportHeight / 3);
    containerRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    onHighlightLineConsumed?.();
  }, [highlightLine, onHighlightLineConsumed, viewportHeight]);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const effectiveScrollTop = Math.max(0, scrollTop - VERTICAL_PADDING_PX);
  const startIndex = Math.max(0, Math.floor(effectiveScrollTop / ROW_HEIGHT_PX) - VIRTUALIZATION_OVERSCAN_ROWS);
  const endIndex = Math.min(
    lines.length - 1,
    Math.ceil((effectiveScrollTop + viewportHeight) / ROW_HEIGHT_PX) + VIRTUALIZATION_OVERSCAN_ROWS,
  );

  const visibleLines = [];
  for (let lineIndex = startIndex; lineIndex <= endIndex; lineIndex++) {
    const isHighlighted = highlightLine === lineIndex;

    visibleLines.push(
      <div
        key={lineIndex}
        className={`absolute left-0 right-0 flex ${isHighlighted ? 'bg-[var(--theme-bg-accent)]/10' : ''}`}
        style={{ top: VERTICAL_PADDING_PX + lineIndex * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
      >
        <span
          className="shrink-0 select-none text-right font-mono text-xs leading-[21px] text-[var(--theme-text-tertiary)]"
          style={{ width: GUTTER_WIDTH_PX }}
        >
          {lineIndex + 1}
        </span>
        <span className="min-w-0 flex-1 whitespace-pre font-mono text-sm leading-[21px] text-[var(--theme-text-primary)]">
          {lines[lineIndex]}
        </span>
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto custom-scrollbar relative ${className}`}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, minWidth: '100%' }} className="relative">
        {visibleLines}
      </div>
    </div>
  );
};
