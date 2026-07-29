import { describe, expect, it } from 'vitest';
import { MODELS_SUPPORTING_RAW_MODE } from '@/constants/modelConfiguration';
import {
  getDefaultThinkingLevelForModel,
  getModelCapabilities,
  isGemini3Model,
  isLiveTranslateModel,
  normalizeThinkingLevelForModel,
  shouldStripThinkingFromContext,
} from './modelCapabilities';

describe('raw mode support', () => {
  it('includes Gemini Robotics-ER 1.6', () => {
    expect(MODELS_SUPPORTING_RAW_MODE).toContain('gemini-robotics-er-1.6-preview');
  });
});

describe('isGemini3Model', () => {
  it('returns false for empty string', () => {
    expect(isGemini3Model('')).toBe(false);
  });

  it('returns true for gemini-3-flash-preview', () => {
    expect(isGemini3Model('gemini-3-flash-preview')).toBe(true);
  });

  it('returns true for gemini-3.6-flash and gemini-3.5-flash-lite', () => {
    expect(isGemini3Model('gemini-3.6-flash')).toBe(true);
    expect(isGemini3Model('models/gemini-3.6-flash')).toBe(true);
    expect(isGemini3Model('gemini-3.5-flash-lite')).toBe(true);
    expect(isGemini3Model('models/gemini-3.5-flash-lite')).toBe(true);
  });

  it('returns true for stable gemini-3-flash IDs', () => {
    expect(isGemini3Model('gemini-3-flash')).toBe(true);
    expect(isGemini3Model('models/gemini-3-flash')).toBe(true);
  });

  it('returns true for gemini-3-pro', () => {
    expect(isGemini3Model('gemini-3-pro-image-preview')).toBe(true);
  });

  it('returns true for gemini-3.1-flash family ids', () => {
    expect(isGemini3Model('gemini-3.1-flash-live-preview')).toBe(true);
    expect(isGemini3Model('gemini-3.5-flash-lite')).toBe(true);
  });

  it('returns true for models/ prefixed IDs', () => {
    expect(isGemini3Model('models/gemini-3-flash-preview')).toBe(true);
  });

  it('returns false for gemini-2.5-flash', () => {
    expect(isGemini3Model('gemini-2.5-flash')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isGemini3Model('Gemini-3-Flash-Preview')).toBe(true);
  });
});

describe('getModelCapabilities', () => {
  it('treats flash live preview models as live audio models', () => {
    expect(getModelCapabilities('gemini-3.1-flash-live-preview').isNativeAudioModel).toBe(true);
  });

  it('does not mark Gemini 3.1 Flash TTS Preview as supporting thinking', () => {
    const capabilities = getModelCapabilities('gemini-3.1-flash-tts-preview');

    expect(capabilities.isTtsModel).toBe(true);
    expect(capabilities.supportsThinkingLevel).toBe(false);
  });

  it('marks Gemini Robotics-ER 1.6 as supporting thinking levels', () => {
    const capabilities = getModelCapabilities('gemini-robotics-er-1.6-preview');

    expect(capabilities.supportsThinkingLevel).toBe(true);
    expect(capabilities.isGemini3).toBe(false);
  });

  it('marks stable Gemini 3 Flash as supporting thinking levels', () => {
    const capabilities = getModelCapabilities('gemini-3-flash');

    expect(capabilities.isGemini3).toBe(true);
    expect(capabilities.supportsThinkingLevel).toBe(true);
  });

  it('marks third-party reasoning models as supporting thinking levels', () => {
    expect(getModelCapabilities('gpt-5.6-sol').supportsThinkingLevel).toBe(true);
    expect(getModelCapabilities('kimi-k3').supportsThinkingLevel).toBe(true);
    expect(getModelCapabilities('claude-sonnet-5').supportsThinkingLevel).toBe(true);
    expect(getModelCapabilities('claude-opus-5').supportsThinkingLevel).toBe(true);
    expect(getModelCapabilities('claude-fable-5').supportsThinkingLevel).toBe(true);
    expect(getModelCapabilities('glm-5.2').supportsThinkingLevel).toBe(true);
    expect(getModelCapabilities('gpt-4o-mini').supportsThinkingLevel).toBe(false);
    expect(getModelCapabilities('claude-haiku-4-5').supportsThinkingLevel).toBe(false);
  });

  it('exposes raw reasoning prefill support as a model capability', () => {
    expect(getModelCapabilities('gemini-3-flash-preview').supportsRawReasoningPrefill).toBe(true);
    expect(getModelCapabilities('gemini-3.6-flash').supportsRawReasoningPrefill).toBe(true);
    expect(getModelCapabilities('gemini-3.5-flash-lite').supportsRawReasoningPrefill).toBe(true);
    expect(getModelCapabilities('gemini-2.5-flash').supportsRawReasoningPrefill).toBe(false);
  });

  it('exposes interaction permissions so UI code does not branch on model families', () => {
    const textCapabilities = getModelCapabilities('gemini-3.1-pro-preview');
    const ttsCapabilities = getModelCapabilities('gemini-3.1-flash-tts-preview');
    const liveCapabilities = getModelCapabilities('gemini-3.1-flash-live-preview');
    const geminiImageCapabilities = getModelCapabilities('gemini-3.1-flash-image-preview');

    expect(textCapabilities.permissions).toMatchObject({
      canAcceptAttachments: true,
      canUseCodeExecution: true,
      canUseUrlContext: true,
      canGenerateSuggestions: true,
      requiresTextPrompt: false,
    });
    expect(ttsCapabilities.permissions).toMatchObject({
      canAcceptAttachments: false,
      canUseTools: false,
      canGenerateSuggestions: false,
      requiresTextPrompt: true,
    });
    expect(liveCapabilities.permissions).toMatchObject({
      canAcceptAttachments: false,
      canUseGoogleSearch: true,
      canUseLocalPython: true,
      canUseCodeExecution: false,
      canGenerateSuggestions: false,
      requiresTextPrompt: false,
    });
    expect(geminiImageCapabilities.permissions).toMatchObject({
      canAcceptAttachments: true,
      canUseGoogleSearch: true,
      canUseCodeExecution: false,
      canGenerateSuggestions: false,
      requiresTextPrompt: true,
    });
  });

  it('exposes the latest Gemini 3.1 Flash Image ratios and sizes', () => {
    const capabilities = getModelCapabilities('gemini-3.1-flash-image-preview');

    expect(capabilities.isImageGenerationModel).toBe(true);
    expect(capabilities).not.toHaveProperty('isRealImagenModel');
    expect(capabilities).not.toHaveProperty('isImagenModel');
    expect(capabilities.supportedAspectRatios).toEqual(expect.arrayContaining(['1:4', '4:1', '1:8', '8:1']));
    expect(capabilities.supportedImageSizes).toEqual(expect.arrayContaining(['512', '1K', '2K', '4K']));
  });
});

describe('getDefaultThinkingLevelForModel', () => {
  it('defaults Gemini 3.1 Flash Live to MINIMAL', () => {
    expect(getDefaultThinkingLevelForModel('gemini-3.1-flash-live-preview')).toBe('MINIMAL');
  });

  it('defaults Gemini 3.1 Flash Image to MINIMAL', () => {
    expect(getDefaultThinkingLevelForModel('gemini-3.1-flash-image-preview')).toBe('MINIMAL');
  });

  it('keeps fallback thinking level for non-special models', () => {
    expect(getDefaultThinkingLevelForModel('gemini-2.5-flash', 'HIGH')).toBe('HIGH');
  });
});

describe('normalizeThinkingLevelForModel', () => {
  it('maps MINIMAL to LOW for Gemini 3 Pro text models', () => {
    expect(normalizeThinkingLevelForModel('gemini-3.1-pro-preview', 'MINIMAL')).toBe('LOW');
    expect(normalizeThinkingLevelForModel('models/gemini-3-pro-preview', 'MINIMAL')).toBe('LOW');
  });

  it('keeps MINIMAL for Gemini 3 Flash models', () => {
    expect(normalizeThinkingLevelForModel('gemini-3-flash-preview', 'MINIMAL')).toBe('MINIMAL');
    expect(normalizeThinkingLevelForModel('gemini-3.5-flash-lite', 'MINIMAL')).toBe('MINIMAL');
  });
});

describe('shouldStripThinkingFromContext', () => {
  it('defaults Gemma conversations to stripping thoughts from follow-up context', () => {
    expect(shouldStripThinkingFromContext('gemma-4-31b-it', false)).toBe(true);
  });

  it('keeps non-Gemma models unchanged when the user has not enabled stripping', () => {
    expect(shouldStripThinkingFromContext('gemini-3-flash-preview', false)).toBe(false);
  });

  it('honors the explicit strip toggle for non-Gemma models', () => {
    expect(shouldStripThinkingFromContext('gemini-3-flash-preview', true)).toBe(true);
  });

  it('forces no stripping when alwaysKeepThinkingInContext is true (overrides Gemma default)', () => {
    expect(shouldStripThinkingFromContext('gemma-4-31b-it', false, true)).toBe(false);
  });

  it('alwaysKeep wins over hideThinkingInContext', () => {
    expect(shouldStripThinkingFromContext('gemini-3-flash-preview', true, true)).toBe(false);
  });

  it('falls back to hide behavior when alwaysKeep is false', () => {
    expect(shouldStripThinkingFromContext('gemini-3-flash-preview', true, false)).toBe(true);
  });

  it('falls back to Gemma default when alwaysKeep is undefined', () => {
    expect(shouldStripThinkingFromContext('gemma-4-31b-it', false, undefined)).toBe(true);
  });
});

describe('isLiveTranslateModel', () => {
  it('returns false for empty string', () => {
    expect(isLiveTranslateModel('')).toBe(false);
  });

  it('returns true for the preview model id', () => {
    expect(isLiveTranslateModel('gemini-3.5-live-translate-preview')).toBe(true);
    expect(isLiveTranslateModel('models/gemini-3.5-live-translate-preview')).toBe(true);
  });

  it('returns false for unrelated models', () => {
    expect(isLiveTranslateModel('gemini-3.1-flash-live-preview')).toBe(false);
    expect(isLiveTranslateModel('gemini-3.6-flash')).toBe(false);
  });
});

describe('Live Translate model capabilities', () => {
  const capabilities = getModelCapabilities('gemini-3.5-live-translate-preview');

  it('is classified as a native audio model so it reuses the live infra', () => {
    expect(capabilities.isNativeAudioModel).toBe(true);
    expect(capabilities.permissions.canUseLiveControls).toBe(true);
    expect(capabilities.isLiveTranslate).toBe(true);
  });

  it('does not require a text prompt (audio-first)', () => {
    expect(capabilities.permissions.requiresTextPrompt).toBe(false);
  });
});
