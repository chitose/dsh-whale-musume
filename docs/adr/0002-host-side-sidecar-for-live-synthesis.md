# Live synthesis runs as a host-spawned local sidecar, not a remote server or in-browser WASM

Dynamic lines need live TTS. Alternatives considered: a remote/self-hosted HTTP TTS server, or in-browser synthesis via onnxruntime-web/WASM. We chose to run kokoro-onnx as a process spawned and managed by the Cordis host (`lib/index.js`), reusing the same manual Python venv install path already documented for offline rendering (`docs/voice-pipeline.md`). This avoids remote-hosting and privacy questions, and avoids a WASM port of kokoro-onnx.

Consequence: the feature is opt-in — only installs that have set up the venv get live voice for dynamic lines; everyone else silently falls back to text-only. The existing MiMo bridge (`dsh-whale-musume:interaction-line` CustomEvent) is kept as an alternative backend rather than replaced, since it's a working integration some installs may already rely on.
