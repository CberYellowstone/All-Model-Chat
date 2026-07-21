import { AVAILABLE_THEMES } from '@/constants/themeRegistry';
import type { AppSettings } from '@/types';
import type { Theme, ThemeColors } from '@/types/theme';

/** When the OS asks for more contrast, promote muted text toward higher ranks. */
const withPreferredContrast = (colors: ThemeColors, prefersMoreContrast: boolean): ThemeColors => {
  if (!prefersMoreContrast) return colors;
  return {
    ...colors,
    textTertiary: colors.textSecondary,
    textSecondary: colors.textPrimary,
    iconSettings: colors.textPrimary,
    iconAttach: colors.textPrimary,
    iconEdit: colors.textPrimary,
    iconHistory: colors.textPrimary,
    iconThought: colors.textSecondary,
  };
};

const generateThemeCssVariables = (colors: ThemeColors): string => {
  let css = ':root {\n';
  for (const [key, value] of Object.entries(colors)) {
    const cssVarName = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    css += `  ${cssVarName}: ${value};\n`;
  }
  css += '}';
  return css;
};

const prefersMoreContrast = (doc: Document): boolean => {
  try {
    return Boolean(doc.defaultView?.matchMedia?.('(prefers-contrast: more)')?.matches);
  } catch {
    return false;
  }
};

export const applyThemeToDocument = (doc: Document, theme: Theme, settings: AppSettings) => {
  const themeVariablesStyleTag = doc.getElementById('theme-variables');
  if (themeVariablesStyleTag) {
    const colors = withPreferredContrast(theme.colors, prefersMoreContrast(doc));
    themeVariablesStyleTag.innerHTML = generateThemeCssVariables(colors);
  }

  const bodyClassList = doc.body.classList;
  AVAILABLE_THEMES.forEach((themeOption) => bodyClassList.remove(`theme-${themeOption.id}`));
  bodyClassList.add(`theme-${theme.id}`, 'antialiased');

  // Reading size targets chat body text (messages set their own px). Chrome uses rem from html.
  doc.body.style.fontSize = `${settings.baseFontSize}px`;
};
