interface LiveTranslateLanguageSettings {
  sourceLanguage: string; // 'auto' 或具体语言名
  targetLanguage: string;
}

export interface LiveTranslateConfig {
  responseModalities: ['AUDIO'];
  systemInstruction: { parts: Array<{ text: string }> };
}

/**
 * 为 Live Translate 模型构建精简 config。
 * 与普通 Live API 的差异：
 *   - 不需要 voiceConfig（翻译音频沿用源说话人音色）
 *   - 不需要 tools / transcription / contextWindowCompression / thinkingConfig
 *   - systemInstruction 仅含语言方向提示
 */
export const buildLiveTranslateConfig = ({
  sourceLanguage,
  targetLanguage,
}: LiveTranslateLanguageSettings): LiveTranslateConfig => {
  const instruction =
    sourceLanguage === 'auto' || !sourceLanguage
      ? `Translate into ${targetLanguage}.`
      : `Translate from ${sourceLanguage} into ${targetLanguage}.`;

  return {
    responseModalities: ['AUDIO'],
    systemInstruction: { parts: [{ text: instruction }] },
  };
};
