import { describe, expect, it } from 'vitest';
import { buildLiveTranslateConfig } from './useLiveTranslateConfig';

describe('buildLiveTranslateConfig', () => {
  it('omits voiceConfig, tools, transcription, compression, and thinking', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'English', targetLanguage: 'Japanese' });

    expect(config).not.toHaveProperty('speechConfig');
    expect(config).not.toHaveProperty('tools');
    expect(config).not.toHaveProperty('inputAudioTranscription');
    expect(config).not.toHaveProperty('outputAudioTranscription');
    expect(config).not.toHaveProperty('contextWindowCompression');
    expect(config).not.toHaveProperty('thinkingConfig');
  });

  it('requests AUDIO modality only', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'English', targetLanguage: 'Japanese' });
    expect(config.responseModalities).toEqual(['AUDIO']);
  });

  it('uses "Translate into" when source is auto', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'auto', targetLanguage: 'Japanese' });
    expect(config.systemInstruction).toEqual({
      parts: [{ text: 'Translate into Japanese.' }],
    });
  });

  it('uses "Translate from X into Y" when source is specified', () => {
    const config = buildLiveTranslateConfig({ sourceLanguage: 'English', targetLanguage: 'Japanese' });
    expect(config.systemInstruction).toEqual({
      parts: [{ text: 'Translate from English into Japanese.' }],
    });
  });
});
