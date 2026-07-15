import { type Theme, type ThemeColors } from '@/types/theme';

const ONYX_THEME_COLORS: ThemeColors = {
  // Backgrounds
  bgPrimary: '#09090b', // Zinc 950 - Main Content
  bgSecondary: '#000000', // True Black - Sidebar/Header (Framing effect)
  bgTertiary: '#18181b', // Zinc 900 - Hover states
  bgAccent: '#3b82f6', // Blue 500 - Vibrant Accent
  bgAccentHover: '#2563eb', // Blue 600
  bgDanger: '#7f1d1d', // Red 900
  bgDangerHover: '#991b1b',
  bgInput: '#121214', // Zinc 925 - Very deep input area
  bgCodeBlock: '#121214', // Deep subtle grey for code
  bgCodeBlockHeader: '#1a1a1c', // Slightly lighter header
  bgUserMessage: '#2563eb', // Blue 600 - Classic user bubble
  bgModelMessage: 'transparent',
  bgErrorMessage: 'rgba(127, 29, 29, 0.25)',
  bgSuccess: 'rgba(6, 78, 59, 0.25)',
  textSuccess: '#4ade80',
  bgInfo: 'rgba(30, 58, 138, 0.25)',
  textInfo: '#60a5fa',
  bgWarning: 'rgba(120, 53, 15, 0.25)',
  textWarning: '#fbbf24',

  // Text
  textPrimary: '#f4f4f5', // Zinc 100 - High contrast text
  textSecondary: '#a1a1aa', // Zinc 400
  textTertiary: '#52525b', // Zinc 600
  textAccent: '#ffffff',
  textDanger: '#fca5a5', // Light Red
  textLink: '#38bdf8', // Sky 400
  textCode: '#e4e4e7', // Zinc 200
  bgUserMessageText: '#ffffff',
  bgModelMessageText: '#e4e4e7',
  bgErrorMessageText: '#fca5a5',

  // Borders
  borderPrimary: '#18181b', // Zinc 900 - blending more with tertiary
  borderSecondary: '#27272a', // Zinc 800 - Slightly lighter for visible borders
  borderFocus: '#3b82f6', // Blue 500

  // Scrollbar
  scrollbarThumb: '#27272a',
  scrollbarTrack: 'transparent',

  // Selection
  selectionBg: 'rgba(59, 130, 246, 0.4)',
  selectionText: '#f4f4f5',

  // Icons
  iconUser: '#ffffff',
  iconModel: '#38bdf8', // Sky 400
  iconError: '#ef4444',
  iconThought: '#71717a',
  iconSettings: '#a1a1aa',
  iconClearChat: '#f4f4f5',
  iconSend: '#ffffff',
  iconAttach: '#a1a1aa',
  iconStop: '#ffffff',
  iconEdit: '#a1a1aa',
  iconHistory: '#a1a1aa',
};

const PEARL_THEME_COLORS: ThemeColors = {
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#f7f7f8',
  bgTertiary: '#ececf1',
  bgAccent: '#343541',
  bgAccentHover: '#202123',
  bgDanger: '#DF3434',
  bgDangerHover: '#B32929',
  bgInput: '#FFFFFF',
  bgCodeBlock: '#F7F7F8',
  bgCodeBlockHeader: 'rgba(236, 236, 241, 0.9)',
  bgUserMessage: '#eef0f4', // Slightly deeper gray for contrast on white
  bgModelMessage: '#FFFFFF',
  bgErrorMessage: '#FEE',
  bgSuccess: 'rgba(22, 163, 74, 0.1)',
  textSuccess: '#16a34a',
  bgInfo: 'rgba(64, 65, 79, 0.05)',
  textInfo: '#40414F',
  bgWarning: 'rgba(212, 167, 44, 0.1)',
  textWarning: '#825F0A',

  // Text — restored hierarchy (primary / secondary / tertiary)
  textPrimary: '#18181b', // Zinc 900
  textSecondary: '#52525b', // Zinc 600
  textTertiary: '#71717a', // Zinc 500
  textAccent: '#FFFFFF',
  textDanger: '#DF3434',
  textLink: '#2563eb',
  textCode: '#18181b',
  bgUserMessageText: '#18181b',
  bgModelMessageText: '#18181b',
  bgErrorMessageText: '#DF3434',

  // Borders
  borderPrimary: '#e8e8ed',
  borderSecondary: '#d9d9e3',
  borderFocus: '#343541',

  // Scrollbar
  scrollbarThumb: '#D9D9E3',
  scrollbarTrack: '#F7F7F8',

  // Selection
  selectionBg: 'rgba(37, 99, 235, 0.22)',
  selectionText: '#0f172a',

  // Icons
  iconUser: '#343541',
  iconModel: '#0d9488',
  iconError: '#DF3434',
  iconThought: '#71717a',
  iconSettings: '#52525b',
  iconClearChat: '#FFFFFF',
  iconSend: '#FFFFFF',
  iconAttach: '#52525b',
  iconStop: '#FFFFFF',
  iconEdit: '#52525b',
  iconHistory: '#52525b',
};

const GRAPHITE_THEME_COLORS: ThemeColors = {
  // Backgrounds
  bgPrimary: '#2f2f2f',
  bgSecondary: '#242424',
  bgTertiary: '#474747',
  bgAccent: '#d4d4d4',
  bgAccentHover: '#f3f3f3',
  bgDanger: '#7f1d1d',
  bgDangerHover: '#991b1b',
  bgInput: '#3f3f3f',
  bgCodeBlock: '#202020',
  bgCodeBlockHeader: '#303030',
  bgUserMessage: '#4a4a4a',
  bgModelMessage: 'transparent',
  bgErrorMessage: 'rgba(127, 29, 29, 0.28)',
  bgSuccess: 'rgba(6, 95, 70, 0.28)',
  textSuccess: '#86efac',
  bgInfo: 'rgba(37, 99, 235, 0.22)',
  textInfo: '#93c5fd',
  bgWarning: 'rgba(120, 53, 15, 0.28)',
  textWarning: '#fde68a',

  // Text
  textPrimary: '#f3f3f3',
  textSecondary: '#c7c7c7',
  textTertiary: '#9a9a9a',
  textAccent: '#171717',
  textDanger: '#fca5a5',
  textLink: '#e5e5e5',
  textCode: '#f5f5f5',
  bgUserMessageText: '#ffffff',
  bgModelMessageText: '#f3f3f3',
  bgErrorMessageText: '#fecaca',

  // Borders
  borderPrimary: '#454545',
  borderSecondary: '#626262',
  borderFocus: '#a3a3a3',

  // Scrollbar
  scrollbarThumb: '#626262',
  scrollbarTrack: 'transparent',

  // Selection
  selectionBg: 'rgba(212, 212, 212, 0.45)',
  selectionText: '#171717',

  // Icons
  iconUser: '#ffffff',
  iconModel: '#d4d4d4',
  iconError: '#f87171',
  iconThought: '#9ca3af',
  iconSettings: '#c7c7c7',
  iconClearChat: '#f3f3f3',
  iconSend: '#171717',
  iconAttach: '#c7c7c7',
  iconStop: '#ffffff',
  iconEdit: '#c7c7c7',
  iconHistory: '#c7c7c7',
};

export const AVAILABLE_THEMES: Theme[] = [
  { id: 'onyx', name: 'Onyx (Dark)', colors: ONYX_THEME_COLORS },
  { id: 'graphite', name: 'Graphite (Gray)', colors: GRAPHITE_THEME_COLORS },
  { id: 'pearl', name: 'Pearl (Light)', colors: PEARL_THEME_COLORS },
];

export const DEFAULT_THEME_ID = 'pearl';
