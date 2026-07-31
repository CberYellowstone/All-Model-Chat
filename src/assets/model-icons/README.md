# Model brand icons

SVG brand marks used by `src/components/shared/ModelIcon.tsx` in model pickers.

| File             | Used for                                     | Source                                           |
| ---------------- | -------------------------------------------- | ------------------------------------------------ |
| `gemini.svg`     | Gemini family (chat, live, TTS, robotics, …) | Lobe Icons recreation of official Gemini sparkle |
| `gemma.svg`      | Gemma models                                 | Lobe Icons / DeepMind Gemma icon                 |
| `nanobanana.svg` | Nano Banana (Gemini image models)            | Lobe Icons community mark                        |

Prefer SVG. Keep files small and square (`viewBox="0 0 24 24"` when possible).

Broader brand reference assets (wordmarks, mono variants, etc.) live in `docs/model-logos/`.

## `providers/`

Provider brand logos (PNG, 1024×1024) rendered as `<img>` in the model picker
and the third-party settings panel for each enabled provider's models. Sourced
from the VoiceHotkey provider-logo set.

| File             | Provider (`ThirdPartyProviderId`) |
| ---------------- | --------------------------------- |
| `openai.png`     | `openai`                          |
| `deepseek.png`   | `deepseek`                        |
| `anthropic.png`  | `anthropic`                       |
| `openrouter.png` | `openrouter`                      |
| `qwen.png`       | `qwen`                            |
| `kimi.png`       | `kimi`                            |
| `glm.png`        | `glm`                             |
| `custom.png`     | `custom`                          |
