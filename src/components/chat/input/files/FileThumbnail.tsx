import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ElementType, type FC, type ReactNode } from 'react';
import type { UploadedFile } from '@/types';
import { SUPPORTED_IMAGE_MIME_TYPES } from '@/constants/fileTypeSupport';
import { getFileTypeCategory, isTextFile } from '@/utils/file/fileTypeClassification';

const LazyPdfFileThumbnail = lazy(() =>
  import('./PdfFileThumbnail').then((module) => ({ default: module.PdfFileThumbnail })),
);

interface FileThumbnailProps {
  file: UploadedFile;
  Icon: ElementType;
  colorClass: string;
  bgClass: string;
}

const getDisplayExtension = (file: UploadedFile) => {
  const extension = file.name.split('.').pop()?.trim();
  if (extension && extension !== file.name) {
    return extension.slice(0, 4).toUpperCase();
  }

  const mimeSuffix = file.type.split('/').pop()?.split(/[+;]/)[0];
  return (mimeSuffix || 'FILE').slice(0, 4).toUpperCase();
};

const getWaveformBars = (file: UploadedFile) => {
  const seed = `${file.name}:${file.size}:${file.type}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }

  return Array.from({ length: 18 }, (_, index) => {
    const wave = Math.sin((hash + index * 29) / 13);
    const stepped = (hash + index * 37) % 41;
    return 24 + Math.round(Math.abs(wave) * 42) + stepped;
  });
};

const useVisibleThumbnailGate = (enabled: boolean) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(() => !enabled || typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (!enabled || isVisible) {
      return undefined;
    }

    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      queueMicrotask(() => setIsVisible(true));
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, isVisible]);

  return { containerRef, isVisible };
};

const TEXT_SKELETON_BAR_COUNT = 3;

/**
 * Deterministic skeleton bar widths for text-file thumbnails. Derived from the
 * same name:size:type hash as `getWaveformBars`, so the same file always renders
 * identically while different files vary. The bars only hint "this is a
 * document" — they never pretend to be readable content.
 */
const getTextSkeletonBarWidths = (file: UploadedFile): number[] => {
  const seed = `${file.name}:${file.size}:${file.type}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }

  return Array.from({ length: TEXT_SKELETON_BAR_COUNT }, (_, index) => {
    const stepped = (hash + index * 37) % 41;
    return 58 + stepped; // 58% – 98%
  });
};

const TextThumbnail = ({ file }: { file: UploadedFile }) => {
  const barWidths = useMemo(() => getTextSkeletonBarWidths(file), [file]);
  const titleWidth = 45 + (barWidths[0] % 16); // 45% – 60%

  return (
    <div
      data-thumbnail-kind="text"
      aria-hidden="true"
      className="flex h-full w-full flex-col justify-center gap-[3px] overflow-hidden bg-[var(--theme-bg-primary)] px-2 py-2"
    >
      <span
        className="h-1.5 rounded-full bg-[var(--theme-text-tertiary)] opacity-60"
        style={{ width: `${titleWidth}%` }}
      />
      {barWidths.map((width, index) => (
        <span
          key={index}
          className="h-1 rounded-full bg-[var(--theme-text-tertiary)] opacity-35"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
};

const PdfThumbnail = ({ file, fallback }: { file: UploadedFile; fallback: ReactNode }) => {
  const shouldLoadPreview = !!file.dataUrl;
  const { containerRef, isVisible } = useVisibleThumbnailGate(shouldLoadPreview);

  return (
    <div ref={containerRef} data-thumbnail-kind="pdf" className="h-full w-full overflow-hidden">
      {shouldLoadPreview && isVisible ? (
        <Suspense fallback={fallback}>
          <LazyPdfFileThumbnail file={file} fallback={fallback} />
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
};

const VideoThumbnail = ({ file, fallback }: { file: UploadedFile; fallback: ReactNode }) => {
  if (!file.dataUrl) {
    return (
      <div data-thumbnail-kind="video" className="h-full w-full">
        {fallback}
      </div>
    );
  }

  return (
    <div data-thumbnail-kind="video" className="relative h-full w-full overflow-hidden bg-black">
      <video
        src={`${file.dataUrl}#t=0.1`}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
        aria-label={file.name}
      />
      <div className="absolute inset-x-2 bottom-2 h-1 rounded-full bg-white/20">
        <div className="h-full w-1/3 rounded-full bg-white/70" />
      </div>
    </div>
  );
};

const AudioThumbnail = ({ file }: { file: UploadedFile }) => {
  const bars = useMemo(() => getWaveformBars(file), [file]);

  return (
    <div
      data-thumbnail-kind="audio"
      className="flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-cyan-950 px-2"
    >
      <div className="flex h-12 w-full items-center justify-center gap-0.5">
        {bars.map((height, index) => (
          <span
            key={index}
            data-waveform-bar="true"
            className="w-1 rounded-full bg-cyan-200/80 shadow-[0_0_8px_rgba(103,232,249,0.35)]"
            style={{ height: `${Math.min(88, height)}%` }}
          />
        ))}
      </div>
    </div>
  );
};

const CoverThumbnail = ({ file, Icon, colorClass, bgClass }: FileThumbnailProps) => {
  const category = getFileTypeCategory(file.type, file.error);
  const extension = getDisplayExtension(file);

  return (
    <div data-thumbnail-kind={category} className={`relative h-full w-full overflow-hidden ${bgClass} p-2`}>
      <div className="absolute inset-0 opacity-50">
        {category === 'spreadsheet' ? (
          <div className="grid h-full w-full grid-cols-4 grid-rows-5 gap-px p-2">
            {Array.from({ length: 20 }, (_, index) => (
              <span key={index} className="rounded-[2px] bg-white/25" />
            ))}
          </div>
        ) : category === 'presentation' ? (
          <div className="flex h-full w-full items-center justify-center p-3">
            <span className="h-10 w-14 rounded border border-white/35 bg-white/20" />
          </div>
        ) : category === 'archive' ? (
          <div className="flex h-full w-full flex-col gap-1 p-3">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="h-1.5 rounded-full bg-white/25" />
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col gap-1.5 p-3">
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="h-1.5 rounded-full bg-white/25" />
            ))}
          </div>
        )}
      </div>
      <div className="relative flex h-full flex-col items-center justify-center gap-1">
        <div className="rounded-lg bg-[var(--theme-bg-primary)]/80 p-1.5 shadow-sm">
          <Icon size={19} className={colorClass} strokeWidth={1.6} />
        </div>
        <span className="max-w-full rounded bg-[var(--theme-bg-primary)]/80 px-1.5 py-0.5 text-xs font-semibold leading-none text-[var(--theme-text-secondary)]">
          {extension}
        </span>
      </div>
    </div>
  );
};

export const FileThumbnail: FC<FileThumbnailProps> = (props) => {
  const { file } = props;
  const category = getFileTypeCategory(file.type, file.error);
  const fallback = <CoverThumbnail {...props} />;

  if (file.dataUrl && SUPPORTED_IMAGE_MIME_TYPES.includes(file.type)) {
    return (
      <img
        data-thumbnail-kind="image"
        src={file.dataUrl}
        alt={file.name}
        className="h-full w-full rounded-lg object-cover shadow-sm"
      />
    );
  }

  if (category === 'pdf') {
    return <PdfThumbnail file={file} fallback={fallback} />;
  }

  if (category === 'video') {
    return <VideoThumbnail file={file} fallback={fallback} />;
  }

  if (category === 'audio') {
    return <AudioThumbnail file={file} />;
  }

  if (category === 'spreadsheet') {
    return fallback;
  }

  if (isTextFile(file)) {
    return <TextThumbnail file={file} />;
  }

  return fallback;
};
