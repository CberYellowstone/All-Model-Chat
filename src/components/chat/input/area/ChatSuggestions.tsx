import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MousePointer2 } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { SUGGESTIONS_KEYS } from '@/constants/welcomeSuggestions';
import { SUGGESTION_CHIP_ACTIVE_CLASS, SUGGESTION_CHIP_CLASS } from '@/constants/designTokens';
import { SuggestionIcon } from './SuggestionIcon';
import { type translations } from '@/i18n/translations';

interface ChatSuggestionsProps {
  show: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  onOrganizeInfoClick?: (suggestion: string) => void;
  onToggleBBox?: () => void;
  isBBoxModeActive?: boolean;
  onToggleGuide?: () => void;
  isGuideModeActive?: boolean;
  isFullscreen: boolean;
}

export const ChatSuggestions: React.FC<ChatSuggestionsProps> = ({
  show,
  onSuggestionClick,
  onOrganizeInfoClick,
  onToggleBBox,
  isBBoxModeActive,
  onToggleGuide,
  isGuideModeActive,
  isFullscreen,
}) => {
  const { t } = useI18n();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [isSuggestionsHovered, setIsSuggestionsHovered] = useState(false);

  const checkScroll = useCallback(() => {
    if (suggestionsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = suggestionsRef.current;
      setShowLeftArrow(scrollLeft > 5); // Small threshold
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, show]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (suggestionsRef.current) {
      const scrollAmount = suggestionsRef.current.clientWidth * 0.6;
      suggestionsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!show || isFullscreen) return null;

  return (
    <div
      className="relative group/suggestions mb-3 sm:mb-4"
      onMouseEnter={() => setIsSuggestionsHovered(true)}
      onMouseLeave={() => setIsSuggestionsHovered(false)}
    >
      <div
        ref={suggestionsRef}
        onScroll={checkScroll}
        className="flex gap-2 overflow-x-auto pb-1 px-1 no-scrollbar fade-mask-x scroll-smooth"
      >
        {SUGGESTIONS_KEYS.map((suggestion, index) => (
          <React.Fragment key={index}>
            <button
              type="button"
              onClick={() => {
                const text = t(suggestion.descKey as keyof typeof translations);
                if (suggestion.specialAction === 'organize' && onOrganizeInfoClick) {
                  onOrganizeInfoClick(text);
                } else if (onSuggestionClick) {
                  onSuggestionClick(text);
                }
              }}
              className={SUGGESTION_CHIP_CLASS}
            >
              <SuggestionIcon iconName={suggestion.icon} />
              <span>{t(suggestion.titleKey as keyof typeof translations)}</span>
            </button>

            {suggestion.specialAction === 'organize' && (
              <>
                {onToggleBBox && (
                  <button
                    type="button"
                    onClick={onToggleBBox}
                    className={isBBoxModeActive ? SUGGESTION_CHIP_ACTIVE_CLASS : SUGGESTION_CHIP_CLASS}
                    aria-label={t('bboxButtonTitle')}
                    aria-pressed={!!isBBoxModeActive}
                    title={t('bboxButtonTitle')}
                  >
                    <SuggestionIcon iconName="Scan" />
                    <span>{t('bboxButtonShort')}</span>
                  </button>
                )}
                {onToggleGuide && (
                  <button
                    type="button"
                    onClick={onToggleGuide}
                    className={isGuideModeActive ? SUGGESTION_CHIP_ACTIVE_CLASS : SUGGESTION_CHIP_CLASS}
                    aria-label={t('guideButtonTitle')}
                    aria-pressed={!!isGuideModeActive}
                    title={t('guideButtonTitle')}
                  >
                    <MousePointer2 size={13} />
                    <span>{t('guideButtonShort')}</span>
                  </button>
                )}
              </>
            )}
          </React.Fragment>
        ))}
      </div>

      {showLeftArrow && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className={`absolute left-0 top-1/2 -translate-y-[calc(50%+4px)] z-10 p-1.5 rounded-full bg-[var(--theme-bg-primary)]/95 border border-[var(--theme-border-secondary)] shadow-md text-[var(--theme-text-primary)] transition-all duration-200 ${isSuggestionsHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-label={t('suggestionsScrollLeft')}
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
      )}
      {showRightArrow && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className={`absolute right-0 top-1/2 -translate-y-[calc(50%+4px)] z-10 p-1.5 rounded-full bg-[var(--theme-bg-primary)]/95 border border-[var(--theme-border-secondary)] shadow-md text-[var(--theme-text-primary)] transition-all duration-200 ${isSuggestionsHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-label={t('suggestionsScrollRight')}
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
};
