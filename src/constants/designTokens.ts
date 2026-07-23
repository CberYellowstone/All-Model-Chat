/**
 * Shared visual scale for AMC UI surfaces.
 * Prefer these over ad-hoc radius / chip classes so composer, sidebar, and chips stay aligned.
 */

/** Caption / meta line — minimum practical UI size (12px at default root). */
export const TYPE_CAPTION_CLASS = 'text-xs leading-tight';

/** Dense mono meta (ids, timestamps) — same floor as caption. */
export const TYPE_CAPTION_MONO_CLASS = 'text-xs font-mono leading-tight tabular-nums';

/** Section overline labels (uppercase groups, code headers). Prefer secondary for contrast. */
export const TYPE_OVERLINE_CLASS = 'text-xs font-bold uppercase tracking-wider text-[var(--theme-text-secondary)]';

/** Muted overline when hierarchy needs more de-emphasis than TYPE_OVERLINE_CLASS. */
export const TYPE_OVERLINE_MUTED_CLASS = 'text-xs font-bold uppercase tracking-wider text-[var(--theme-text-tertiary)]';

const RADIUS_CLASS = {
  /** 6px — dense controls, inline badges */
  sm: 'rounded-md',
  /** 8–10px — list rows, menus, session items */
  md: 'rounded-lg',
  /** 12px — cards, header icon buttons */
  lg: 'rounded-xl',
  /** 16px — message bubbles, large cards */
  xl: 'rounded-2xl',
  /** 26px — chat composer shell */
  pill: 'rounded-[1.625rem]',
  full: 'rounded-full',
} as const;

/** Composer outer shell (non-fullscreen). */
export const COMPOSER_SHELL_RADIUS_CLASS = RADIUS_CLASS.pill;

/** Default / hover suggestion chip (soft, no elevation). */
export const SUGGESTION_CHIP_CLASS =
  'flex items-center gap-[0.3rem] sm:gap-[0.4rem] px-[0.6rem] py-[0.4rem] sm:px-[0.8rem] sm:py-[0.5rem] rounded-lg border border-[var(--theme-border-secondary)]/70 bg-[var(--theme-bg-tertiary)]/35 text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-border-secondary)] text-xs sm:text-sm font-medium whitespace-nowrap transition-colors';

/** Active mode chip (BBox / Guide) — stronger than hover. */
export const SUGGESTION_CHIP_ACTIVE_CLASS =
  'flex items-center gap-[0.3rem] sm:gap-[0.4rem] px-[0.6rem] py-[0.4rem] sm:px-[0.8rem] sm:py-[0.5rem] rounded-lg border border-[var(--theme-bg-accent)] bg-[var(--theme-bg-accent)] text-[var(--theme-text-accent)] hover:bg-[var(--theme-bg-accent-hover)] hover:border-[var(--theme-bg-accent-hover)] text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shadow-sm';

/** Intra-cluster gap for composer icon groups. */
export const COMPOSER_CLUSTER_GAP_CLASS = 'gap-0.5 sm:gap-1';

/** Gap between left/right composer clusters. */
export const COMPOSER_CLUSTER_SEPARATION_CLASS = 'gap-3';

/** Shared height for chat-input toolbar controls (image settings, etc.). */
const TOOLBAR_CONTROL_HEIGHT_CLASS = 'h-9';

/** Soft cluster wrapping image-generation controls above the composer. */
export const TOOLBAR_IMAGE_CLUSTER_CLASS =
  'flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-xl border border-[var(--theme-border-secondary)]/60 bg-[var(--theme-bg-tertiary)]/30 px-1.5 py-1';

/** Segmented control track (size, output mode) — outer height matches toolbar controls. */
export const TOOLBAR_SEGMENTED_TRACK_CLASS = `${TOOLBAR_CONTROL_HEIGHT_CLASS} inline-flex items-center gap-0.5 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)] p-0.5`;

const TOOLBAR_SEGMENT_BASE =
  'h-full inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-border-focus)]';
/** Idle segment inside a segmented track. */
export const TOOLBAR_SEGMENT_IDLE_CLASS = `${TOOLBAR_SEGMENT_BASE} text-[var(--theme-text-tertiary)] hover:bg-[var(--theme-bg-tertiary)]/70 hover:text-[var(--theme-text-primary)]`;

/** Active segment inside a segmented track. */
export const TOOLBAR_SEGMENT_ACTIVE_CLASS = `${TOOLBAR_SEGMENT_BASE} bg-[var(--theme-bg-accent)]/12 text-[var(--theme-text-primary)] shadow-sm`;

/** Standalone toggle chip (e.g. quad images) aligned with segmented track height. */
export const TOOLBAR_TOGGLE_IDLE_CLASS = `${TOOLBAR_CONTROL_HEIGHT_CLASS} inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-medium text-[var(--theme-text-tertiary)] transition-colors hover:bg-[var(--theme-bg-tertiary)]/70 hover:text-[var(--theme-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)]`;

export const TOOLBAR_TOGGLE_ACTIVE_CLASS = `${TOOLBAR_CONTROL_HEIGHT_CLASS} inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--theme-border-focus)]/40 bg-[var(--theme-bg-accent)]/12 px-2.5 text-xs font-medium text-[var(--theme-text-primary)] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)]`;

// --- Settings surface ---

/** Soft card wrapping a settings subsection. */
export const SETTINGS_SECTION_CARD_CLASS =
  'rounded-xl border border-[var(--theme-border-secondary)]/60 bg-[var(--theme-bg-secondary)]/35 p-4';

/** Uppercase section label used across settings. */
export const SETTINGS_SECTION_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-secondary)]';

/** Numeric value badge (font size, etc.) — neutral, not link-colored. */
export const SETTINGS_VALUE_BADGE_CLASS =
  'rounded-md bg-[var(--theme-bg-tertiary)] px-2 py-0.5 font-mono text-sm tabular-nums text-[var(--theme-text-primary)]';

/** Segmented control track (theme, language, scope). */
export const SETTINGS_SEGMENTED_TRACK_CLASS =
  'inline-flex items-center gap-0.5 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)]/50 p-1';

export const SETTINGS_SEGMENTED_ACTIVE_CLASS =
  'px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--theme-bg-accent)] text-[var(--theme-text-accent)] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)]';

export const SETTINGS_SEGMENTED_IDLE_CLASS =
  'px-3 py-1.5 text-xs font-medium rounded-md text-[var(--theme-text-secondary)] transition-colors hover:text-[var(--theme-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)] disabled:cursor-not-allowed disabled:opacity-50';

/** Active settings nav tab — aligned with chat session selection. */
export const SETTINGS_NAV_ACTIVE_CLASS = 'bg-[var(--theme-bg-accent)]/10 text-[var(--theme-text-primary)] font-medium';

export const SETTINGS_NAV_IDLE_CLASS =
  'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)]/50 hover:text-[var(--theme-text-primary)]';
