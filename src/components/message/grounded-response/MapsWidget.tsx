import React, { useMemo, useState } from 'react';
import { MapPin, ChevronDown, ExternalLink } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { buildMapsEmbedUrl, type MapsPlace } from '@/utils/groundingMetadata';

interface MapsWidgetProps {
  places: MapsPlace[];
}

/**
 * Renders an interactive Google Maps embed alongside the list of grounded
 * places. Uses the keyless `maps.google.com/maps?q=...&output=embed` endpoint
 * so no separate Maps API key is required.
 */
export const MapsWidget: React.FC<MapsWidgetProps> = ({ places }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<string>(places[0]?.uri ?? '');

  // Use the place title as the query for the keyless embed — the `cid` in the
  // chunk URI is a numeric ID that the keyless embed cannot resolve to a location.
  const embedSrc = useMemo(() => {
    if (!selectedPlace) return '';
    const place = places.find((p) => p.uri === selectedPlace);
    if (!place) return '';
    return buildMapsEmbedUrl(place);
  }, [selectedPlace, places]);

  if (!places || places.length === 0) return null;

  return (
    <div className="mt-3 pt-2 border-t border-[var(--theme-border-secondary)]/30 animate-in fade-in slide-in-from-top-1 duration-200">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 mb-2 cursor-pointer"
        aria-expanded={expanded}
      >
        <MapPin size={11} className="text-[var(--theme-text-tertiary)]" strokeWidth={2} />
        <h4 className="text-[10px] font-bold uppercase text-[var(--theme-text-tertiary)] tracking-widest">
          {t('mapsSourcesTitle')}
        </h4>
        <ChevronDown
          size={14}
          className={`ml-auto text-[var(--theme-text-tertiary)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {expanded && (
        <div className="space-y-2">
          {embedSrc && (
            <div className="overflow-hidden rounded-xl border border-[var(--theme-border-secondary)]/40">
              <iframe
                title={t('mapsSourcesTitle')}
                src={embedSrc}
                className="w-full"
                style={{ height: 280, border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {places.map((place, i) => {
              const isActive = place.uri === selectedPlace;
              return (
                <div
                  key={`maps-place-${i}`}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--theme-bg-tertiary)]/60 border-[var(--theme-border-focus)]'
                      : 'bg-[var(--theme-bg-tertiary)]/20 border-[var(--theme-border-secondary)]/30 hover:bg-[var(--theme-bg-tertiary)]/60'
                  }`}
                  onClick={() => setSelectedPlace(place.uri)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPlace(place.uri);
                    }
                  }}
                >
                  <MapPin
                    size={14}
                    className={`flex-shrink-0 ${isActive ? 'text-[var(--theme-text-link)]' : 'text-[var(--theme-text-tertiary)]'}`}
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-[var(--theme-text-primary)] truncate leading-tight">
                      {place.title}
                    </div>
                  </div>
                  <a
                    href={place.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-link)] transition-colors"
                    title={place.title}
                  >
                    <ExternalLink size={12} strokeWidth={2} />
                  </a>
                  <span className="text-[9px] font-mono font-medium text-[var(--theme-text-tertiary)] opacity-40">
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
