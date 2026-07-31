import type { LiveArtifactsPromptMode } from '@/types';

/**
 * Determine if Live Artifacts mode is active from the app settings and
 * current chat settings. This is a convenience wrapper for CommonComponentData.
 */
export function isLiveArtifactsModeFromSettings(args: {
  systemInstruction?: string | null;
  promptMode?: LiveArtifactsPromptMode | null;
  liveArtifactsSystemPrompt?: string | null;
  liveArtifactsSystemPrompts?: Partial<Record<LiveArtifactsPromptMode, string>> | null;
}): boolean {
  const { systemInstruction, promptMode, liveArtifactsSystemPrompt, liveArtifactsSystemPrompts } = args;

  if (!systemInstruction) return false;

  if (
    systemInstruction.includes('[Live Artifacts Inline Protocol') ||
    systemInstruction.includes('[Live Artifacts System Prompt')
  ) {
    return true;
  }

  if (promptMode && liveArtifactsSystemPrompts) {
    const overridePrompt = liveArtifactsSystemPrompts[promptMode];
    if (overridePrompt?.trim() && systemInstruction.trim() === overridePrompt.trim()) {
      return true;
    }
  }

  if (liveArtifactsSystemPrompt?.trim() && systemInstruction.trim() === liveArtifactsSystemPrompt.trim()) {
    return true;
  }

  return false;
}
