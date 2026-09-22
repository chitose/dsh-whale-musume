# Whale-chan Voice & Feedback

Whale-chan (the mascot) speaks feedback to the user as bubble lines; this context defines how a line becomes audio.

## Language

**Mascot feedback**:
Any line of text Whale-chan displays in a bubble, whether fixed dialogue or a dynamic line.
_Avoid_: notification, message, alert.

**Fixed dialogue**:
A bubble line drawn from the curated, committed line set, pre-rendered offline to a shipped `.ogg` clip.
_Avoid_: static line, scripted line.

**Dynamic line**:
A bubble line composed at runtime from live data (e.g. an achievement label), with no pre-rendered clip.
_Avoid_: dynamic text, runtime message.

**Voice backend**:
The mechanism that turns a dynamic line into audio at runtime: the kokoro-live sidecar, the MiMo bridge, or none (silent, text-only).
_Avoid_: TTS engine, voice provider.

**Kokoro-live sidecar**:
A host-spawned, persistent local kokoro-onnx process exposing a local HTTP endpoint, used to synthesize dynamic lines on demand. Opt-in — only present on installs that have set up the kokoro-onnx venv.
_Avoid_: TTS server, voice daemon.

**MiMo bridge**:
The existing optional integration point — a `dsh-whale-musume:interaction-line` CustomEvent — that an external MiMo TTS integration can listen for.
_Avoid_: TTS event, voice hook.
