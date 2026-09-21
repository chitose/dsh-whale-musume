# Security Policy

## Credential handling

- The runtime plugin makes zero network requests and never reads, writes, or transmits any API key or credential; neither the plugin code nor the test code contains any key.
- The pose art generation pipeline (`scripts/gen-assets.py`) calls a third-party image generation API; the required key is read only from the `DSH_JMRAI_API_KEY` environment variable and is never committed to the repository. Normal installation and use do not require that script, nor any key.

## Data

All data is stored only in the user's browser `localStorage` (under the `whale-moe:` prefix) and never leaves the local machine.

## Reporting vulnerabilities

Please report via the repository's Security Advisory or an Issue, and include the DSH version, browser version, reproduction steps, and screenshots where possible.
