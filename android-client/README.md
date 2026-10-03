# Continuity Studio Android

The Android app is now standalone for Nano Banana image generation.

## Prefilled defaults

You do not need to configure a project before generating. The app starts with:

- Nano Banana 2
- 16:9 YouTube long-form
- The Rise / cinematic technology-history continuity prompt
- strict no-watermark / no-random-text constraints
- draft autosave
- automatic result saving
- optional reference images

Normal scene workflow:

1. paste narration / scene idea
2. optionally attach reference images
3. tap Generate image

The result automatically saves to:

`Downloads/Continuity Studio/Generated/`

## One-time API key

The only account-specific item that cannot be shipped already filled is the user's Gemini API key.

It is entered once, encrypted with Android Keystore, and reused automatically afterward.

Standalone models:

- Nano Banana 2 Lite → `gemini-3.1-flash-lite-image`
- Nano Banana 2 → `gemini-3.1-flash-image`
- Nano Banana Pro → `gemini-3-pro-image`

## Desktop separation

The old PC-connected client remains available as the optional `DesktopCompanionActivity`.

The standalone generator does not require the desktop app or PC to be running.
