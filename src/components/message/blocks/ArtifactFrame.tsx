import { logService } from '@/services/logService';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useWindowContext } from '@/contexts/WindowContext';
import {
  buildStreamingHtmlPreviewRenderPayload,
  buildHtmlPreviewSrcDoc,
  buildStreamingHtmlPreviewSrcDoc,
  HTML_PREVIEW_CLEAR_SELECTION_EVENT,
  HTML_PREVIEW_COPY_EVENT,
  HTML_PREVIEW_DIAGNOSTIC_EVENT,
  HTML_PREVIEW_MESSAGE_CHANNEL,
  HTML_PREVIEW_STREAM_RENDER_EVENT,
} from '@/utils/html-preview/previewDocument';
import { normalizeLiveArtifactFollowupPayload, type LiveArtifactFollowupPayload } from '@/utils/live-artifacts/liveArtifactFollowup';
import {
  createRelayedLiveArtifactSelectionDetail,
  dispatchLiveArtifactSelection,
  LIVE_ARTIFACT_CLEAR_SELECTION_EVENT,
} from '@/utils/text-selection/liveArtifactSelection';

interface ArtifactFrameProps {
  html: string;
  cacheKey?: string;
  isLoading?: boolean;
  baseFontSize?: number;
  themeId?: string;
  onFollowUp?: (payload: LiveArtifactFollowupPayload) => void;
}

type HtmlPreviewBridgeMessage = {
  channel?: string;
  event?: 'ready' | 'escape' | 'resize' | 'followup' | 'selection' | 'copy' | 'diagnostic';
  height?: number;
  payload?: unknown;
};

const MIN_FRAME_HEIGHT = 120;
const DEFAULT_FRAME_HEIGHT = 320;
const MAX_FRAME_HEIGHT_CACHE_ENTRIES = 200;
const STREAMING_SRC_DOC_THROTTLE_MS = 120;
const frameHeightCache = new Map<string, number>();

const normalizeFrameHeight = (height: number) => Math.max(MIN_FRAME_HEIGHT, Math.ceil(height));

const hashString = (value: string): string => {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }

  return (hash >>> 0).toString(36);
};

const getContentFrameHeightCacheKey = (html: string, cacheKey?: string): string => {
  const contentHash = `${html.length}:${hashString(html)}`;
  return cacheKey ? `${cacheKey}:${contentHash}` : `html:${contentHash}`;
};

const getStreamingFrameHeightCacheKey = (cacheKey?: string): string | undefined => {
  return cacheKey ? `stream:${cacheKey}` : undefined;
};

const readCachedFrameHeight = (heightCacheKey: string, fallbackHeightCacheKey?: string): number => {
  return (
    frameHeightCache.get(heightCacheKey) ??
    (fallbackHeightCacheKey ? frameHeightCache.get(fallbackHeightCacheKey) : undefined) ??
    DEFAULT_FRAME_HEIGHT
  );
};

const cacheFrameHeight = (heightCacheKey: string, height: number) => {
  if (frameHeightCache.has(heightCacheKey)) {
    frameHeightCache.delete(heightCacheKey);
  }

  frameHeightCache.set(heightCacheKey, height);

  if (frameHeightCache.size > MAX_FRAME_HEIGHT_CACHE_ENTRIES) {
    const oldestKey = frameHeightCache.keys().next().value;
    if (oldestKey) {
      frameHeightCache.delete(oldestKey);
    }
  }
};

export const ArtifactFrame: React.FC<ArtifactFrameProps> = ({
  html,
  cacheKey,
  isLoading = false,
  baseFontSize,
  themeId,
  onFollowUp,
}) => {
  const { t } = useI18n();
  const { window: targetWindow } = useWindowContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const latestStreamingHtmlRef = useRef(html);
  const isLoadingRef = useRef(isLoading);
  const lastPostedStreamingHtmlRef = useRef<string | null>(null);
  const streamingFlushTimeoutRef = useRef<number | null>(null);
  const contentHeightCacheKey = useMemo(() => getContentFrameHeightCacheKey(html, cacheKey), [cacheKey, html]);
  const streamingHeightCacheKey = useMemo(() => getStreamingFrameHeightCacheKey(cacheKey), [cacheKey]);
  const heightCacheKey = isLoading && streamingHeightCacheKey ? streamingHeightCacheKey : contentHeightCacheKey;
  const streamingSrcDoc = useMemo(
    () => buildStreamingHtmlPreviewSrcDoc({ baseFontSize, themeId }),
    [baseFontSize, themeId],
  );
  const [frameHeightState, setFrameHeightState] = useState(() => ({
    heightCacheKey,
    height: readCachedFrameHeight(heightCacheKey, streamingHeightCacheKey),
  }));
  const frameHeight =
    frameHeightState.heightCacheKey === heightCacheKey
      ? frameHeightState.height
      : readCachedFrameHeight(heightCacheKey, streamingHeightCacheKey);
  const finalSrcDoc = useMemo(
    () => buildHtmlPreviewSrcDoc(html, { baseFontSize, themeId }),
    [baseFontSize, html, themeId],
  );
  const srcDoc = isLoading ? streamingSrcDoc : finalSrcDoc;

  useLayoutEffect(() => {
    latestStreamingHtmlRef.current = html;
  }, [html]);

  useLayoutEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const clearStreamingFlushTimeout = useCallback(() => {
    if (streamingFlushTimeoutRef.current === null) {
      return;
    }

    targetWindow.clearTimeout(streamingFlushTimeoutRef.current);
    streamingFlushTimeoutRef.current = null;
  }, [targetWindow]);

  // Returns false when the iframe is not ready yet so callers can retry.
  const postStreamingHtml = useCallback((nextHtml: string, force = false): boolean => {
    if (!force && lastPostedStreamingHtmlRef.current === nextHtml) {
      return true;
    }

    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) {
      return false;
    }

    try {
      iframeWindow.postMessage(
        {
          channel: HTML_PREVIEW_MESSAGE_CHANNEL,
          event: HTML_PREVIEW_STREAM_RENDER_EVENT,
          html: buildStreamingHtmlPreviewRenderPayload(nextHtml),
        },
        '*',
      );
      lastPostedStreamingHtmlRef.current = nextHtml;
      return true;
    } catch (error) {
      logService.warn('Failed to post Live Artifact streaming html:', error);
      return false;
    }
  }, []);

  const scheduleStreamingHtmlFlush = useCallback(
    (force = false) => {
      if (streamingFlushTimeoutRef.current !== null) {
        return;
      }

      streamingFlushTimeoutRef.current = targetWindow.setTimeout(() => {
        streamingFlushTimeoutRef.current = null;
        if (!isLoadingRef.current) {
          return;
        }

        const posted = postStreamingHtml(latestStreamingHtmlRef.current, force);
        // contentWindow can appear after the first timeout (Virtuoso remount / slow srcDoc).
        if (!posted) {
          scheduleStreamingHtmlFlush(force);
        }
      }, STREAMING_SRC_DOC_THROTTLE_MS);
    },
    [postStreamingHtml, targetWindow],
  );

  const flushStreamingHtmlNow = useCallback(
    (force = false) => {
      if (!isLoadingRef.current) {
        return;
      }

      const posted = postStreamingHtml(latestStreamingHtmlRef.current, force);
      if (!posted) {
        scheduleStreamingHtmlFlush(force);
      }
    },
    [postStreamingHtml, scheduleStreamingHtmlFlush],
  );

  useEffect(() => {
    if (!isLoading) {
      clearStreamingFlushTimeout();
      lastPostedStreamingHtmlRef.current = null;
      return;
    }

    scheduleStreamingHtmlFlush();
  }, [clearStreamingFlushTimeout, html, isLoading, scheduleStreamingHtmlFlush]);

  useEffect(() => {
    return () => clearStreamingFlushTimeout();
  }, [clearStreamingFlushTimeout]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<HtmlPreviewBridgeMessage>) => {
      const data = event.data;
      if (!data || data.channel !== HTML_PREVIEW_MESSAGE_CHANNEL) {
        return;
      }

      // Sandboxed iframes without allow-same-origin post messages from the opaque origin "null".
      if (event.origin !== 'null') {
        return;
      }

      const iframeWindow = iframeRef.current?.contentWindow;
      if (iframeWindow && event.source !== iframeWindow) {
        return;
      }

      // Bridge ready means the streaming runner is listening — re-push HTML that may
      // have been posted too early (or lost during Virtuoso remount).
      if (data.event === 'ready') {
        flushStreamingHtmlNow(true);
        return;
      }

      if (data.event === 'selection') {
        dispatchLiveArtifactSelection(
          targetWindow,
          createRelayedLiveArtifactSelectionDetail(iframeRef.current, data.payload),
        );
        return;
      }

      if (data.event === 'followup') {
        const payload = normalizeLiveArtifactFollowupPayload(data.payload);
        if (!payload) {
          logService.warn('Ignored invalid Live Artifact follow-up payload.');
          return;
        }

        onFollowUp?.(payload);
        return;
      }

      if (data.event === HTML_PREVIEW_COPY_EVENT) {
        const copyText =
          data.payload && typeof data.payload === 'object' && 'text' in data.payload
            ? (data.payload as { text?: unknown }).text
            : undefined;
        if (typeof copyText === 'string' && copyText.trim()) {
          // The sandboxed iframe lacks allow-same-origin, so navigator.clipboard
          // is unavailable there; the parent page writes to the clipboard instead.
          targetWindow.navigator.clipboard?.writeText(copyText).catch((error: unknown) => {
            logService.warn('Failed to copy Live Artifact text:', error);
          });
        }
        return;
      }

      if (data.event === HTML_PREVIEW_DIAGNOSTIC_EVENT) {
        logService.warn('Live Artifact preview diagnostic:', data.payload);
        return;
      }

      if (data.event !== 'resize') {
        return;
      }

      if (typeof data.height === 'number' && Number.isFinite(data.height)) {
        const nextHeight = normalizeFrameHeight(data.height);
        cacheFrameHeight(heightCacheKey, nextHeight);
        if (heightCacheKey !== contentHeightCacheKey) {
          cacheFrameHeight(contentHeightCacheKey, nextHeight);
        }
        if (streamingHeightCacheKey && heightCacheKey !== streamingHeightCacheKey) {
          cacheFrameHeight(streamingHeightCacheKey, nextHeight);
        }
        setFrameHeightState((currentState) =>
          currentState.heightCacheKey === heightCacheKey && currentState.height === nextHeight
            ? currentState
            : { heightCacheKey, height: nextHeight },
        );
      }
    };

    targetWindow.addEventListener('message', handleMessage);
    return () => targetWindow.removeEventListener('message', handleMessage);
  }, [
    contentHeightCacheKey,
    flushStreamingHtmlNow,
    heightCacheKey,
    onFollowUp,
    streamingHeightCacheKey,
    targetWindow,
  ]);

  useEffect(() => {
    const handleClearSelection = () => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          channel: HTML_PREVIEW_MESSAGE_CHANNEL,
          event: HTML_PREVIEW_CLEAR_SELECTION_EVENT,
        },
        '*',
      );
    };

    targetWindow.addEventListener(LIVE_ARTIFACT_CLEAR_SELECTION_EVENT, handleClearSelection);
    return () => targetWindow.removeEventListener(LIVE_ARTIFACT_CLEAR_SELECTION_EVENT, handleClearSelection);
  }, [targetWindow]);

  return (
    <div
      data-live-artifact-frame="true"
      data-artifact-source={html}
      className="group/artifact relative my-3 w-full overflow-visible"
    >
      <div
        data-live-artifact-viewport="true"
        className="relative overflow-hidden rounded-lg bg-transparent"
        style={{ height: frameHeight }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          title={t('htmlPreviewTitle')}
          className="h-full w-full border-0 bg-transparent"
          // SECURITY: allow-same-origin is intentionally omitted (opaque origin).
          // allow-popups enables target="_blank" external links in Live Artifacts.
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          allow="clipboard-write"
          scrolling="no"
          onLoad={() => {
            // Prefer refs so remount/load races always flush the latest streaming html.
            flushStreamingHtmlNow(true);
          }}
        />
      </div>
    </div>
  );
};
