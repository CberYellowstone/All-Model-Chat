import { LOCAL_PYTHON_SYSTEM_PROMPT } from './localPython';
import type { LiveArtifactsPromptMode } from '@/types';

type PromptLanguage = 'en' | 'zh';
export type LiveArtifactsPromptTheme = 'dark' | 'light';

const LIVE_ARTIFACTS_PROMPT_MARKERS = [
  '[Live Artifacts Protocol]',
  '[Live Artifacts Protocol - zh]',
  '[Live Artifacts Protocol - en]',
  '[Live Artifacts Inline Protocol - zh]',
  '[Live Artifacts Inline Protocol - en]',
  '[Live Artifacts Full HTML Protocol - zh]',
  '[Live Artifacts Full HTML Protocol - en]',
  // Legacy Canvas markers are recognized so old saved settings can still be toggled off.
  '[Canvas Artifact Protocol]',
  '[Canvas Artifact Protocol - zh]',
  '[Canvas Artifact Protocol - en]',
  '[Canvas Artifact Protocol v2]',
  '[Canvas Artifact Protocol v2 - zh]',
  '[Canvas Artifact Protocol v2 - en]',
  '<title>Canvas 助手：响应式视觉指南</title>',
  '<title>Canvas Assistant: Responsive Visual Guide</title>',
];
const BBOX_PROMPT_MARKER = '**任务：** 请作为一位计算机视觉专家';
const HD_GUIDE_PROMPT_MARKER = '### 系统提示词：高清引导标注专家';

export const isLiveArtifactsSystemInstruction = (instruction?: string | null) =>
  !!instruction && LIVE_ARTIFACTS_PROMPT_MARKERS.some((marker) => instruction.includes(marker));

export const isBboxSystemInstruction = (instruction?: string | null) =>
  !!instruction && instruction.includes(BBOX_PROMPT_MARKER);

export const isHdGuideSystemInstruction = (instruction?: string | null) =>
  !!instruction && instruction.includes(HD_GUIDE_PROMPT_MARKER);

export const resolveLiveArtifactsPromptTheme = (themeId?: string | null): LiveArtifactsPromptTheme | undefined => {
  if (themeId === 'onyx') {
    return 'dark';
  }

  if (themeId === 'pearl') {
    return 'light';
  }

  return undefined;
};

const getLiveArtifactsThemeGuidance = (language: PromptLanguage, theme: LiveArtifactsPromptTheme) => {
  if (language === 'en') {
    return theme === 'dark'
      ? '## Current Page Theme\n\nThe current AMC-WebUI page uses a dark theme. Default artifacts to a dark UI: dark backgrounds, light text, subdued borders/shadows, and color-scheme: dark; unless the user explicitly asks for a light artifact, do not create large white surfaces.\n'
      : '## Current Page Theme\n\nThe current AMC-WebUI page uses a light theme. Default artifacts to a light UI: light backgrounds, dark text, clear borders/shadows, and color-scheme: light; unless the user explicitly asks for a dark artifact, do not create large black surfaces.\n';
  }

  return theme === 'dark'
    ? '## 当前页面主题\n\n当前 AMC-WebUI 页面使用深色主题。产物默认采用深色界面：深背景、浅文字、低亮度边框/阴影，并设置 color-scheme: dark；除非用户明确要求浅色产物，不要生成大面积白底。\n'
    : '## 当前页面主题\n\n当前 AMC-WebUI 页面使用浅色主题。产物默认采用浅色界面：浅背景、深文字、清晰边框/阴影，并设置 color-scheme: light；除非用户明确要求深色产物，不要生成大面积黑底。\n';
};

const appendLiveArtifactsThemeGuidance = (
  prompt: string,
  language: PromptLanguage,
  theme?: LiveArtifactsPromptTheme,
) => (theme ? `${prompt.trimEnd()}\n\n${getLiveArtifactsThemeGuidance(language, theme)}` : prompt);

export const loadLiveArtifactsSystemPrompt = async (
  language: PromptLanguage = 'zh',
  mode: LiveArtifactsPromptMode = 'inline',
  theme?: LiveArtifactsPromptTheme,
) => {
  const prompts = await import('./liveArtifacts');
  if (mode === 'fullHtml') {
    const prompt =
      language === 'en'
        ? prompts.LIVE_ARTIFACTS_FULL_HTML_SYSTEM_PROMPT_EN
        : prompts.LIVE_ARTIFACTS_FULL_HTML_SYSTEM_PROMPT_ZH;
    return appendLiveArtifactsThemeGuidance(prompt, language, theme);
  }

  if (mode === 'full') {
    const prompt =
      language === 'en' ? prompts.LIVE_ARTIFACTS_SYSTEM_PROMPT_EN : prompts.LIVE_ARTIFACTS_SYSTEM_PROMPT_ZH;
    return appendLiveArtifactsThemeGuidance(prompt, language, theme);
  }

  const prompt =
    language === 'en' ? prompts.LIVE_ARTIFACTS_INLINE_SYSTEM_PROMPT_EN : prompts.LIVE_ARTIFACTS_INLINE_SYSTEM_PROMPT_ZH;
  return appendLiveArtifactsThemeGuidance(prompt, language, theme);
};

export const loadDeepSearchSystemPrompt = async () => (await import('./deepSearch')).DEEP_SEARCH_SYSTEM_PROMPT;

export const loadLocalPythonSystemPrompt = async () => LOCAL_PYTHON_SYSTEM_PROMPT;

export const loadBboxSystemPrompt = async () => (await import('./vision')).BBOX_SYSTEM_PROMPT;

export const loadHdGuideSystemPrompt = async () => (await import('./vision')).HD_GUIDE_SYSTEM_PROMPT;
