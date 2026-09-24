# Voice pipeline: live Kokoro only

Umika speaks through the local Kokoro sidecar. The repo no longer ships pre-generated `.ogg` clips or a voice manifest.

## What is source

| Path | Role | Edit by hand? |
|---|---|---|
| `assets/whale-moe-core.js` | English source lines | yes |
| `.voice-preview/ja/part-01..06.json` | Durable Japanese translation batches | yes |
| `assets/voice/ja/translations.json` | Committed Japanese text used by the browser and sidecar | only if you do not re-run `--merge` |
| `assets/dsh-whale-moe.js` | Presenter; posts bubble lines to `/voice/synthesize` | yes |
| `lib/voice-sidecar.py` | Kokoro + Argos synthesis server | yes |

Generated WAV files live in the per-user voice cache under `DSH_WHALE_VOICE_HOME` or the default app data directory. They are not committed.

## Setup

```powershell
npm run setup:voice
```

That creates the Python environment, installs Kokoro and Argos, and downloads the model files. After setup, restart DSH Web.

## Change A Translation

1. Edit the relevant `.voice-preview/ja/part-*.json` entry.
2. Rebuild the merged translation store:

```powershell
node scripts/voice-pilot.mjs --merge
node scripts/voice-pilot.mjs --all
```

3. Install updated assets into a theme-mode DSH copy when needed:

```powershell
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>"
```

## Verify

```powershell
npm test
npm run qa:voice
```

`npm run qa:voice` uses the real Kokoro setup and checks English and Japanese synthesis through the local voice route.

## Runtime Behavior

The presenter posts every displayed bubble line to `/api/dsh-whale-musume/voice/synthesize`. The sidecar localizes Japanese text from `assets/voice/ja/translations.json`, applies personalized names, returns displayed text, and returns a cached WAV URL when speech is enabled.

If setup or synthesis fails, the bubble remains text-only and the optional MiMo bridge may handle the line. There is no bundled clip fallback.

Console diagnostics are available at `window.__dshWhaleVoice`. Miss reasons are `voice-off`, `bubbles-off`, `no-live-audio`, `autoplay-blocked`, `autoplay-refused`, and `playback-error`.
