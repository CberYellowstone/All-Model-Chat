import { logService } from '@/services/logService';
import React, { type RefObject } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { buildUnrestrictedHtmlPreviewSrcDoc } from '@/utils/html-preview/previewDocument';

interface HtmlPreviewContentProps {
  iframeRef: RefObject<HTMLIFrameElement>;
  htmlContent: string;
  scale: number;
}

export const HtmlPreviewContent: React.FC<HtmlPreviewContentProps> = ({ iframeRef, htmlContent, scale }) => {
  const { t } = useI18n();
  const handleIframeError = (event: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    logService.error('Iframe loading error:', event);
  };

  return (
    <div className="flex-grow relative overflow-auto custom-scrollbar bg-[var(--theme-bg-tertiary)]">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(var(--theme-text-tertiary) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <iframe
        ref={iframeRef}
        srcDoc={buildUnrestrictedHtmlPreviewSrcDoc(htmlContent)}
        title={t('htmlPreviewIframeTitle')}
        className="border-none bg-white shadow-sm origin-top-left"
        style={{
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
        // Code-block preview is intentionally unrestricted so full HTML/CSS/JS demos
        // render (CDN scripts, localStorage, same-origin APIs, nested frames, etc.).
        // Live Artifacts in the message list keep a stricter sandbox without same-origin.
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-same-origin allow-popups-to-escape-sandbox allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation"
        onError={handleIframeError}
      />
    </div>
  );
};
