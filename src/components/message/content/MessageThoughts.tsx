import { logService } from '@/services/logService';
import React, { useMemo, useState } from 'react';
import { type ChatMessage, type AppSettings, type SideViewContent, type UploadedFile } from '@/types';
import { getGeminiKeyForRequest } from '@/utils/apiKeySelection';
import { getThinkingStreamTail, parseThinkingSections } from '@/utils/chat/parsing';
import { THINKING_STRIP_MAX_SOURCE_LINES } from './thoughts/thinkingStripMetrics';
import { translateTextApi } from '@/services/api/generation/textApi';
import { DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import { DEFAULT_THOUGHT_TRANSLATION_MODEL_ID } from '@/constants/modelConfiguration';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ThinkingHeader } from './thoughts/ThinkingHeader';
import { ThinkingStrip } from './thoughts/ThinkingStrip';
import { ThinkingActions } from './thoughts/ThinkingActions';
import { ThoughtContent } from './thoughts/ThoughtContent';
import { useMessageStream } from '@/hooks/ui/useMessageStream';
import { extractRawThinkingBlocks } from '@/utils/chat/reasoning';

interface MessageThoughtsProps {
  message: ChatMessage;
  showThoughts: boolean;
  appSettings: AppSettings;
  themeId: string;
  onImageClick: (file: UploadedFile) => void;
  onOpenHtmlPreview: (html: string, options?: { initialTrueFullscreen?: boolean }) => void;
  expandCodeBlocksByDefault: boolean;
  isMermaidRenderingEnabled: boolean;
  isGraphvizRenderingEnabled: boolean;
  onOpenSidePanel: (content: SideViewContent) => void;
}

export const MessageThoughts: React.FC<MessageThoughtsProps> = ({
  message,
  showThoughts,
  appSettings,
  themeId,
  onImageClick,
  onOpenHtmlPreview,
  expandCodeBlocksByDefault,
  isMermaidRenderingEnabled,
  isGraphvizRenderingEnabled,
  onOpenSidePanel,
}) => {
  const { content, thoughts, isLoading, role, id: messageId } = message;

  // Subscribe to live thoughts if loading to check visibility
  const { streamContent, streamThoughts } = useMessageStream(messageId, !!isLoading && role === 'model');
  const rawThinkingExtraction = extractRawThinkingBlocks(streamContent ? `${content || ''}${streamContent}` : content);
  const effectiveThoughts = [thoughts, streamThoughts, rawThinkingExtraction.thoughts].filter(Boolean).join('\n\n');

  const areThoughtsVisible = role === 'model' && effectiveThoughts && showThoughts;

  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const [translatedThoughts, setTranslatedThoughts] = useState<string | null>(null);
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);
  const [isTranslatingThoughts, setIsTranslatingThoughts] = useState(false);

  // Copy Hook
  const { isCopied, copyToClipboard } = useCopyToClipboard(2000);

  const thoughtsTail = useMemo(
    () => getThinkingStreamTail(effectiveThoughts, THINKING_STRIP_MAX_SOURCE_LINES),
    [effectiveThoughts],
  );

  // Sectioned Gemini-style streams (each section opens with a `**Title**`
  // line) drive the sectioned strip; flat/third-party streams fall back to the
  // tail window via the null return.
  const thinkingSections = useMemo(() => parseThinkingSections(effectiveThoughts), [effectiveThoughts]);

  // Preview strip is a "thinking in progress" indicator: visible while thoughts
  // are still streaming, regardless of whether the full message has finished
  // loading. thinkingActive is the reliable signal that the model is currently
  // reasoning — it flips off when thinking settles (content switch) but turns
  // back on if the model re-enters thinking (interleaved thought after code
  // execution), so the strip re-shows instead of staying collapsed. Before the
  // first commit (or for older messages without the field) the strip shows as
  // long as no thinking time has been settled yet.
  const showThinkingStrip =
    !isExpanded &&
    !!isLoading &&
    thoughtsTail.length > 0 &&
    (message.thinkingActive === true || (message.thinkingActive === undefined && message.thinkingTimeMs === undefined));

  if (!areThoughtsVisible) return null;

  const handleTranslateThoughts = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isShowingTranslation) {
      setIsShowingTranslation(false);
      return;
    }

    if (translatedThoughts) {
      setIsShowingTranslation(true);
      return;
    }

    if (!effectiveThoughts || isTranslatingThoughts) return;

    setIsTranslatingThoughts(true);
    try {
      const tempSettings = { ...DEFAULT_CHAT_SETTINGS, ...appSettings };
      const keyResult = getGeminiKeyForRequest(appSettings, tempSettings, { skipIncrement: true });
      if ('error' in keyResult) {
        logService.error('API Key error for translation:', keyResult.error);
        return;
      }

      const result = await translateTextApi(
        keyResult.key,
        effectiveThoughts,
        appSettings.thoughtTranslationTargetLanguage || 'Simplified Chinese',
        appSettings.thoughtTranslationModelId || DEFAULT_THOUGHT_TRANSLATION_MODEL_ID,
      );
      setTranslatedThoughts(result);
      setIsShowingTranslation(true);
    } catch (error) {
      logService.error('Failed to translate thoughts:', error);
    } finally {
      setIsTranslatingThoughts(false);
    }
  };

  const handleCopyThoughts = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const textToCopy = isShowingTranslation && translatedThoughts ? translatedThoughts : effectiveThoughts;
    if (textToCopy) {
      copyToClipboard(textToCopy);
    }
  };
  const toggleExpanded = () => setIsExpanded((value) => !value);
  const handleToggleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ignore key events bubbling up from inner buttons so Enter/Space on the
    // translate/copy actions no longer collapses the accordion or cancels the click.
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    e.preventDefault();
    toggleExpanded();
  };

  const hasFiles = message.files && message.files.length > 0;

  return (
    <div className={`mb-2 ${hasFiles ? 'mt-1' : '-mt-2'} message-thoughts-block`}>
      <div
        className={`group rounded-xl bg-[var(--theme-bg-tertiary)]/20 overflow-hidden transition-all duration-200 ${isExpanded ? 'bg-[var(--theme-bg-tertiary)]/30 shadow-sm' : ''}`}
      >
        <div
          className="flex select-none items-center justify-between gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--theme-bg-tertiary)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-border-focus)]"
          onClick={toggleExpanded}
          onKeyDown={handleToggleKeyDown}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
        >
          <ThinkingHeader
            isLoading={!!isLoading}
            thinkingTimeMs={message.thinkingTimeMs}
            generationStartTime={message.generationStartTime}
            firstTokenTimeMs={message.firstTokenTimeMs}
            isExpanded={isExpanded}
          />

          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {/* Stop propagation to prevent toggling when clicking actions */}
            <div onClick={(e) => e.stopPropagation()}>
              <ThinkingActions
                isExpanded={isExpanded}
                isShowingTranslation={isShowingTranslation}
                isTranslatingThoughts={isTranslatingThoughts}
                isCopied={isCopied}
                onTranslate={handleTranslateThoughts}
                onCopy={handleCopyThoughts}
              />
            </div>
          </div>
        </div>

        {showThinkingStrip && (
          <ThinkingStrip
            thoughtsTail={thoughtsTail}
            sections={thinkingSections}
            thinkingSource={message.thinkingSource}
          />
        )}

        <div className={`thought-process-accordion ${isExpanded ? 'expanded' : ''}`}>
          <div className="thought-process-inner">
            <ThoughtContent
              messageId={messageId}
              isLoading={!!isLoading}
              content={isShowingTranslation && translatedThoughts ? translatedThoughts : effectiveThoughts}
              onImageClick={onImageClick}
              onOpenHtmlPreview={onOpenHtmlPreview}
              expandCodeBlocksByDefault={expandCodeBlocksByDefault}
              isMermaidRenderingEnabled={isMermaidRenderingEnabled}
              isGraphvizRenderingEnabled={isGraphvizRenderingEnabled}
              themeId={themeId}
              onOpenSidePanel={onOpenSidePanel}
              unwrapMislabeledHtmlBlocks={appSettings.unwrapMislabeledHtmlBlocks ?? true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
