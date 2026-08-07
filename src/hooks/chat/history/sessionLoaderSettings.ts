import { DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import { sanitizeSessionModel as sanitizeSessionModelWithFallback, sortSessionsInPlace } from '@/stores/sessionModels';
import type { AppSettings, ChatSettings, SavedChatSession } from '@/types';

export const sortSessionsByPinnedAndTimestamp = (sessions: SavedChatSession[]) => sortSessionsInPlace([...sessions]);

export const sanitizeSessionModel = (session: SavedChatSession): SavedChatSession =>
  sanitizeSessionModelWithFallback(session, DEFAULT_CHAT_SETTINGS.modelId);

const getMostRecentTemplateSession = (sessions: SavedChatSession[], excludeSessionId?: string | null) =>
  [...sessions]
    .filter((session) => session.id !== excludeSessionId)
    .sort((leftSession, rightSession) => rightSession.timestamp - leftSession.timestamp)[0];

interface CreateSettingsForNewChatOptions {
  appSettings: AppSettings;
  savedSessions: SavedChatSession[];
  explicitTemplateSession?: SavedChatSession;
  excludeTemplateSessionId?: string | null;
}

export const createSettingsForNewChat = ({
  appSettings,
  savedSessions,
  explicitTemplateSession,
  excludeTemplateSessionId,
}: CreateSettingsForNewChatOptions): ChatSettings => {
  const baseSettings: ChatSettings = {
    ...DEFAULT_CHAT_SETTINGS,
    ...appSettings,
    lockedApiKey: null,
  };

  const templateSession =
    explicitTemplateSession || getMostRecentTemplateSession(savedSessions, excludeTemplateSessionId);

  if (!templateSession) {
    return baseSettings;
  }

  const sanitizedTemplateSettings = sanitizeSessionModel(templateSession).settings;

  return {
    ...baseSettings,
    // 全量继承模板会话的设置：modelId、providerId、temperature/topP/topK、
    // thinkingBudget/thinkingLevel、ttsVoice、mediaResolution，以及所有工具开关
    // （Google Search / Maps / Code Execution / Pyodide / URL Context / Deep Search / Keep Thinking）。
    ...sanitizedTemplateSettings,
    // systemInstruction 属于会话内容（如场景提示词），沿用全局默认，保持现有语义。
    systemInstruction: baseSettings.systemInstruction,
    // 锁定 API Key 始终重置，新聊天重新轮换。
    lockedApiKey: null,
  };
};
