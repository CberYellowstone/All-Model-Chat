import type { ApiMode, ChatSettings } from '@/types';

type CodeExecutionModeSettings = Pick<ChatSettings, 'isCodeExecutionEnabled' | 'isLocalPythonEnabled'> & {
  apiMode?: ApiMode;
  isThirdPartyApiEnabled?: boolean;
};

export const CODE_EXECUTION_TEXT_FILE_LIMIT_BYTES = 2 * 1024 * 1024;

// Server-side code execution is a Gemini-native tool. Never treat it as active
// while a third-party provider is selected, even when the toggle stayed on from
// a Gemini chat — that residue currently makes text files send as binary
// inlineData, which the OpenAI-compatible / Anthropic builders reject.
const isThirdPartyMode = (settings: CodeExecutionModeSettings): boolean =>
  (settings.apiMode ?? 'gemini-native') === 'third-party' &&
  (settings.isThirdPartyApiEnabled === undefined ? true : settings.isThirdPartyApiEnabled);

export const isServerCodeExecutionMode = (settings: CodeExecutionModeSettings): boolean =>
  !isThirdPartyMode(settings) && Boolean(settings.isCodeExecutionEnabled && !settings.isLocalPythonEnabled);
