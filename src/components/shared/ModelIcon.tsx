import { Box, Sparkles } from 'lucide-react';

import geminiIconUrl from '@/assets/model-icons/gemini.svg';
import gemmaIconUrl from '@/assets/model-icons/gemma.svg';
import nanoBananaIconUrl from '@/assets/model-icons/nanobanana.svg';
import openaiLogoUrl from '@/assets/model-icons/providers/openai.png';
import deepseekLogoUrl from '@/assets/model-icons/providers/deepseek.png';
import anthropicLogoUrl from '@/assets/model-icons/providers/anthropic.png';
import openrouterLogoUrl from '@/assets/model-icons/providers/openrouter.png';
import qwenLogoUrl from '@/assets/model-icons/providers/qwen.png';
import kimiLogoUrl from '@/assets/model-icons/providers/kimi.png';
import glmLogoUrl from '@/assets/model-icons/providers/glm.png';
import customLogoUrl from '@/assets/model-icons/providers/custom.png';
import { getCachedModelCapabilities } from '@/stores/modelCapabilitiesStore';
import { THIRD_PARTY_PROVIDER_LABELS } from '@/utils/thirdPartyApiProviders';
import { type ModelOption, type ThirdPartyProviderId } from '@/types';

/** Brand logos/PNGs read smaller than stroke icons at the same px; 22 keeps list rows balanced. */
const MODEL_ICON_SIZE = 22;

const THIRD_PARTY_PROVIDER_LOGO: Record<ThirdPartyProviderId, string> = {
  openai: openaiLogoUrl,
  deepseek: deepseekLogoUrl,
  anthropic: anthropicLogoUrl,
  openrouter: openrouterLogoUrl,
  qwen: qwenLogoUrl,
  kimi: kimiLogoUrl,
  glm: glmLogoUrl,
  custom: customLogoUrl,
};

const THIRD_PARTY_PROVIDER_ICON_COLOR: Partial<Record<ThirdPartyProviderId, string>> = {
  openai: 'text-emerald-500 dark:text-emerald-400',
  deepseek: 'text-blue-500 dark:text-blue-400',
  anthropic: 'text-orange-500 dark:text-orange-400',
  openrouter: 'text-fuchsia-500 dark:text-fuchsia-400',
  qwen: 'text-violet-500 dark:text-violet-400',
  kimi: 'text-cyan-500 dark:text-cyan-400',
  glm: 'text-rose-500 dark:text-rose-400',
  custom: 'text-slate-500 dark:text-slate-400',
};

type ModelBrandIconKey = 'gemini' | 'gemma' | 'nanobanana';

const BRAND_ICON_SRC: Record<ModelBrandIconKey, string> = {
  gemini: geminiIconUrl,
  gemma: gemmaIconUrl,
  nanobanana: nanoBananaIconUrl,
};

const BRAND_ICON_ALT: Record<ModelBrandIconKey, string> = {
  gemini: 'Gemini',
  gemma: 'Gemma',
  nanobanana: 'Nano Banana',
};

const BrandModelIcon = ({ brand, size = MODEL_ICON_SIZE }: { brand: ModelBrandIconKey; size?: number }) => (
  <img
    src={BRAND_ICON_SRC[brand]}
    alt={BRAND_ICON_ALT[brand]}
    width={size}
    height={size}
    draggable={false}
    data-model-brand-icon={brand}
    className="flex-shrink-0 object-contain"
    style={{ width: size, height: size }}
  />
);

const ProviderLogo = ({ providerId, size = MODEL_ICON_SIZE }: { providerId: ThirdPartyProviderId; size?: number }) => (
  <img
    src={THIRD_PARTY_PROVIDER_LOGO[providerId]}
    alt={THIRD_PARTY_PROVIDER_LABELS[providerId] ?? providerId}
    width={size}
    height={size}
    draggable={false}
    data-model-provider-logo={providerId}
    className="flex-shrink-0 object-contain"
    style={{ width: size, height: size }}
  />
);

const resolveBrandIcon = (model: ModelOption): ModelBrandIconKey | null => {
  const normalizedId = model.id.toLowerCase();
  const { isGemini3ImageModel, isGemini31FlashImageModel, isFlashImageModel, isImageGenerationModel, isGemmaModel } =
    getCachedModelCapabilities(model.id);

  // Nano Banana family: Gemini native image models (Pro / 2 / Lite / legacy Flash Image)
  if (
    isGemini3ImageModel ||
    isGemini31FlashImageModel ||
    isFlashImageModel ||
    isImageGenerationModel ||
    (normalizedId.includes('gemini') && normalizedId.includes('image')) ||
    normalizedId.includes('nano-banana') ||
    normalizedId.includes('nanobanana')
  ) {
    return 'nanobanana';
  }

  if (isGemmaModel || normalizedId.includes('gemma')) {
    return 'gemma';
  }

  // All other Gemini family models (Flash/Pro/Lite/Live/TTS/Robotics/Audio, etc.)
  if (normalizedId.includes('gemini')) {
    return 'gemini';
  }

  return null;
};

export const getModelIcon = (model: ModelOption | undefined) => {
  if (!model) {
    return <Box size={MODEL_ICON_SIZE} className="text-[var(--theme-text-tertiary)]" strokeWidth={1.5} />;
  }

  const brand = resolveBrandIcon(model);
  if (brand) {
    return <BrandModelIcon brand={brand} />;
  }

  if (model.providerId) {
    // When a provider logo asset exists it takes precedence over the colored
    // box fallback so the picker shows the real brand mark.
    return <ProviderLogo providerId={model.providerId} />;
  }

  if (model.isPinned) {
    return (
      <Sparkles size={MODEL_ICON_SIZE} className="text-sky-500 dark:text-sky-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  return (
    <Box
      size={MODEL_ICON_SIZE}
      className="text-[var(--theme-text-tertiary)] opacity-70 flex-shrink-0"
      strokeWidth={1.5}
    />
  );
};

export { THIRD_PARTY_PROVIDER_LOGO, THIRD_PARTY_PROVIDER_ICON_COLOR };
