import type { LiveArtifactsPromptMode } from '@/types';

/**
 * Checks whether Live Artifacts mode is currently active for a given set of
 * settings. The key indicator is a system instruction that contains the Live
 * Artifacts protocol marker string.
 */
export function isLiveArtifactsModeActive(args: {
  systemInstruction?: string | null;
  promptMode?: LiveArtifactsPromptMode;
  liveArtifactsSystemPrompt?: string | null;
  liveArtifactsSystemPrompts?: Partial<Record<LiveArtifactsPromptMode, string>> | null;
}): boolean {
  const { systemInstruction, promptMode, liveArtifactsSystemPrompt, liveArtifactsSystemPrompts } = args;

  // Check for the protocol markers in the system instruction
  const instruction = systemInstruction?.trim() ?? '';
  if (
    instruction.includes('[Live Artifacts Inline Protocol') ||
    instruction.includes('[Live Artifacts System Prompt')
  ) {
    return true;
  }

  // Check prompt mode override
  if (promptMode && liveArtifactsSystemPrompts?.[promptMode]?.trim()) {
    const overridePrompt = liveArtifactsSystemPrompts[promptMode]!.trim();
    if (instruction === overridePrompt) {
      return true;
    }
  }

  // Fallback: check the single-system-prompt override
  if (liveArtifactsSystemPrompt?.trim() && instruction === liveArtifactsSystemPrompt.trim()) {
    return true;
  }

  return false;
}

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
