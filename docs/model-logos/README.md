# Model Logos (design reference)

Brand marks related to default models. Used for local preview and design reference only —
runtime UI icons live in `src/assets/model-icons/`.

Open `index.html` in a browser for a gallery.

## Layout

```
docs/model-logos/
  index.html              # local gallery
  README.md
  deepmind-*.svg
  gemini-sparkle*.svg
  gemini-wordmark*.svg
  gemma-*.svg|png
  google-color.svg
  nanobanana-*.svg
```

## Files

| File                                 | Brand                             | Source                                     | Official?                        |
| ------------------------------------ | --------------------------------- | ------------------------------------------ | -------------------------------- |
| `gemini-wordmark.svg`                | Gemini wordmark                   | Wikimedia Commons (from gemini.google.com) | Yes (trademarked)                |
| `gemini-wordmark-2025.svg`           | Gemini 2025 rainbow star wordmark | Wikimedia                                  | Yes-derived                      |
| `gemini-sparkle.svg` / `-mono.svg`   | Gemini sparkle icon               | Lobe Icons                                 | Community recreation             |
| `gemma-icon.png`                     | Gemma                             | google-deepmind/gemma GitHub               | Yes (Apache-2.0)                 |
| `gemma-color.svg` / `gemma-mono.svg` | Gemma                             | Lobe Icons                                 | Community                        |
| `nanobanana-*.svg`                   | Nano Banana                       | Lobe Icons                                 | Community (not Google brand kit) |
| `deepmind-*.svg`                     | DeepMind                          | Lobe Icons                                 | Community                        |
| `google-color.svg`                   | Google G                          | Lobe Icons                                 | Community recreation             |

## Runtime mapping

| App icon (`src/assets/model-icons/`) | Source here            |
| ------------------------------------ | ---------------------- |
| `gemini.svg`                         | `gemini-sparkle.svg`   |
| `gemma.svg`                          | `gemma-color.svg`      |
| `nanobanana.svg`                     | `nanobanana-color.svg` |
