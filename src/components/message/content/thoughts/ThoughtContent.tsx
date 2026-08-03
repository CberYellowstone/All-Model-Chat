import React from 'react';
import { LazyMarkdownRenderer } from '@/components/message/LazyMarkdownRenderer';
import { type SideViewContent, type UploadedFile } from '@/types';
import { useMessageStream } from '@/hooks/ui/useMessageStream';

interface ThoughtContentProps {
  messageId: string;
  isLoading: boolean;
  content: string; // Persisted content
  onImageClick: (file: UploadedFile) => void;
  onOpenHtmlPreview: (html: string, options?: { initialTrueFullscreen?: boolean }) => void;
  expandCodeBlocksByDefault: boolean;
  isMermaidRenderingEnabled: boolean;
  isGraphvizRenderingEnabled: boolean;
  themeId: string;
  onOpenSidePanel: (content: SideViewContent) => void;
}

export const ThoughtContent: React.FC<ThoughtContentProps> = ({
  messageId,
  isLoading,
  content,
  onImageClick,
  onOpenHtmlPreview,
  expandCodeBlocksByDefault,
  isMermaidRenderingEnabled,
  isGraphvizRenderingEnabled,
  themeId,
  onOpenSidePanel,
}) => {
  // Subscribe to live thoughts if loading
  const { streamThoughts } = useMessageStream(messageId, isLoading);
  const effectiveContent = streamThoughts || content;

  return (
    <div className="px-3 pb-3 pt-2 border-t border-[var(--theme-border-secondary)]/50 text-xs relative">
      <div className="prose prose-sm max-w-none dark:prose-invert text-[var(--theme-text-secondary)] leading-relaxed markdown-body thought-process-content opacity-90">
        <LazyMarkdownRenderer
          messageId={messageId}
          content={effectiveContent}
          isLoading={isLoading}
          onImageClick={onImageClick}
          onOpenHtmlPreview={onOpenHtmlPreview}
          expandCodeBlocksByDefault={expandCodeBlocksByDefault}
          isMermaidRenderingEnabled={isMermaidRenderingEnabled}
          isGraphvizRenderingEnabled={isGraphvizRenderingEnabled}
          allowHtml={true}
          themeId={themeId}
          onOpenSidePanel={onOpenSidePanel}
        />
      </div>
    </div>
  );
};
