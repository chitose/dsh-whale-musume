# Security Policy

## Credential handling

- Runtime voice requests stay on loopback. The plugin never reads, writes, or transmits an API key or credential; neither the plugin code nor the test code contains any key.
- The pose art generation pipeline (`scripts/gen-assets.py`) calls a third-party image generation API; the required key is read only from the `DSH_JMRAI_API_KEY` environment variable and is never committed to the repository. Normal installation and use do not require that script, nor any key.
- Live voice uses a local Kokoro Python sidecar. `npm run setup:voice` downloads the Kokoro and Argos models once; dialogue text is sent only to the loopback sidecar through the DSH host and generated audio is cached in the user's local voice data directory. The bundled Japanese pack remains a local fallback.

## Data

Preferences and progression remain in browser `localStorage` (under the `whale-moe:` prefix). Generated voice audio is stored in the local voice cache and never leaves the machine.

## Reporting vulnerabilities

Please report via the repository's Security Advisory or an Issue, and include the DSH version, browser version, reproduction steps, and screenshots where possible.
