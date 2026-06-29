import { AudioWaveform, Banana, Box, Image as ImageIcon, Layers3, ScanEye, Sparkles, Speech } from 'lucide-react';

import { getCachedModelCapabilities } from '@/stores/modelCapabilitiesStore';
import { isGeminiRoboticsModel } from '@/utils/modelCapabilities';
import { type ModelOption, type ThirdPartyProviderId } from '@/types';

const MODEL_ICON_SIZE = 18;

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

export const getModelIcon = (model: ModelOption | undefined) => {
  if (!model) return <Box size={MODEL_ICON_SIZE} className="text-[var(--theme-text-tertiary)]" strokeWidth={1.5} />;
  const { id, isPinned } = model;
  const normalizedId = id.toLowerCase();
  const { isNativeAudioModel, isTtsModel, isRealImagenModel, isGemini3ImageModel, isFlashImageModel, isGemmaModel } =
    getCachedModelCapabilities(id);

  if (isNativeAudioModel) {
    return (
      <AudioWaveform
        size={MODEL_ICON_SIZE}
        className="text-amber-500 dark:text-amber-400 flex-shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  if (isTtsModel) {
    return (
      <Speech size={MODEL_ICON_SIZE} className="text-purple-500 dark:text-purple-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isRealImagenModel) {
    return (
      <ImageIcon size={MODEL_ICON_SIZE} className="text-rose-500 dark:text-rose-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isGemini3ImageModel || isFlashImageModel) {
    return (
      <Banana size={MODEL_ICON_SIZE} className="text-yellow-500 dark:text-yellow-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isGeminiRoboticsModel(id)) {
    return (
      <ScanEye
        size={MODEL_ICON_SIZE}
        className="text-emerald-500 dark:text-emerald-400 flex-shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  if (isGemmaModel) {
    return (
      <Layers3
        size={MODEL_ICON_SIZE}
        className="text-violet-500 dark:text-violet-400 flex-shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  if (normalizedId.includes('gemini')) {
    return (
      <Sparkles size={MODEL_ICON_SIZE} className="text-sky-500 dark:text-sky-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (model.providerId) {
    const color = THIRD_PARTY_PROVIDER_ICON_COLOR[model.providerId] ?? 'text-[var(--theme-text-tertiary)]';
    return (
      <Box size={MODEL_ICON_SIZE} className={`${color} flex-shrink-0`} strokeWidth={1.5} />
    );
  }

  if (isPinned) {
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
