import { logService } from '@/services/logService';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Loader2, Repeat } from 'lucide-react';
import { type SideViewContent, type UploadedFile } from '@/types';
import { MESSAGE_BLOCK_BUTTON_CLASS } from '@/constants/buttonClasses';
import { DiagramWrapper } from './parts/DiagramWrapper';
import { useI18n } from '@/contexts/I18nContext';
import { getVizInstance, renderDotToSvgCached } from '@/features/graphviz/vizRuntime';

const GRAPHVIZ_EXPORT_SCALE = 5;

interface GraphvizBlockProps {
  code: string;
  onImageClick: (file: UploadedFile) => void;
  isLoading: boolean;
  themeId: string;
  onOpenSidePanel: (content: SideViewContent) => void;
  renderDelayMs?: number;
}

export const GraphvizBlock: React.FC<GraphvizBlockProps> = ({
  code,
  onImageClick,
  isLoading: isMessageLoading,
  themeId,
  onOpenSidePanel,
  renderDelayMs = 500,
}) => {
  const { t } = useI18n();
  const [manualLayout, setManualLayout] = useState<'LR' | 'TB' | null>(null);

  const effectiveLayout = useMemo<'LR' | 'TB'>(() => {
    if (manualLayout) return manualLayout;
    const match = code.match(/rankdir\s*=\s*(["']?)(LR|TB|RL|BT)\1/i);
    if (match) {
      const dir = match[2].toUpperCase();
      if (dir === 'TB' || dir === 'BT') return 'TB';
      if (dir === 'LR' || dir === 'RL') return 'LR';
    }
    return 'LR';
  }, [code, manualLayout]);

  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState('');
  const [isRendering, setIsRendering] = useState(true);

  const [isDownloading, setIsDownloading] = useState(false);
  const [diagramFile, setDiagramFile] = useState<UploadedFile | null>(null);
  const [showSource, setShowSource] = useState(false);

  const diagramContainerRef = useRef<HTMLDivElement>(null);

  // Warm the viz-js runtime (WASM chunk) on mount so the first diagram render
  // does not block on the network fetch.
  useEffect(() => {
    getVizInstance().catch((error) => {
      logService.error('Failed to initialize Viz', error);
    });
  }, []);

  const setDiagramFileFromSvg = useCallback((svgString: string) => {
    const id = `graphviz-svg-${Math.random().toString(36).substring(2, 9)}`;
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
    setDiagramFile({
      id,
      name: 'graphviz-diagram.svg',
      type: 'image/svg+xml',
      size: svgString.length,
      dataUrl: svgDataUrl,
      uploadState: 'active',
    });
  }, []);

  const renderGraph = useCallback(async () => {
    if (!code) {
      setSvgContent('');
      setError('');
      setIsRendering(false);
      return;
    }

    setIsRendering(true);

    const result = await renderDotToSvgCached(code, { themeId, layout: effectiveLayout });

    if (result.ok) {
      setSvgContent(result.svg);
      setDiagramFileFromSvg(result.svg);
      setError('');
      setIsRendering(false);
      return;
    }

    // Streaming messages keep the spinner up until the stream settles; final
    // messages surface the error fallback.
    if (isMessageLoading) {
      setIsRendering(true);
    } else {
      const errorMessage =
        result.error === 'render-failed'
          ? result.message.replace(/.*error:\s*/i, '')
          : t('diagramRenderGraphvizFailed');
      setError(errorMessage);
      setSvgContent('');
      setIsRendering(false);
    }
  }, [code, effectiveLayout, isMessageLoading, setDiagramFileFromSvg, t, themeId]);

  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (!isMounted) return;
      renderGraph().catch((error) => {
        logService.error('Failed to render Graphviz diagram', error);
      });
    }, renderDelayMs);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [renderGraph, renderDelayMs]);

  const handleToggleLayout = () => {
    setManualLayout(effectiveLayout === 'LR' ? 'TB' : 'LR');
  };

  const handleDownloadJpg = async () => {
    if (!svgContent || isDownloading) return;
    setIsDownloading(true);
    try {
      const { exportSvgAsImage } = await import('@/utils/export/image');
      await exportSvgAsImage(svgContent, `graphviz-diagram-${Date.now()}.jpg`, GRAPHVIZ_EXPORT_SCALE, 'image/jpeg');
    } catch (error) {
      setError(error instanceof Error ? error.message : t('diagramExportFailed'));
    } finally {
      setIsDownloading(false);
    }
  };

  const layoutToggleBtn = (
    <button
      onClick={handleToggleLayout}
      disabled={isRendering}
      className={MESSAGE_BLOCK_BUTTON_CLASS}
      title={t('diagramToggleLayout').replace('{layout}', effectiveLayout)}
    >
      {isRendering ? <Loader2 size={14} className="animate-spin" /> : <Repeat size={14} />}
    </button>
  );

  return (
    <DiagramWrapper
      title="Graphviz"
      code={code}
      error={error}
      isRendering={isRendering}
      isDownloading={isDownloading}
      diagramFile={diagramFile}
      showSource={showSource}
      setShowSource={setShowSource}
      onImageClick={onImageClick}
      onDownloadJpg={handleDownloadJpg}
      onOpenSidePanel={() => onOpenSidePanel({ type: 'graphviz', content: code, title: t('diagramGraphvizTitle') })}
      themeId={themeId}
      containerRef={diagramContainerRef}
      extraActions={layoutToggleBtn}
    >
      <div className="w-full overflow-x-auto custom-scrollbar" dangerouslySetInnerHTML={{ __html: svgContent }} />
    </DiagramWrapper>
  );
};
