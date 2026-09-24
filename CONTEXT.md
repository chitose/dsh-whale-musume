# Umika Voice & Feedback

Umika (the mascot) speaks feedback to the user as bubble lines; this context defines how a line becomes audio.

## Language

**Mascot feedback**:
Any line of text Umika displays in a bubble, whether fixed dialogue or a dynamic line.
_Avoid_: notification, message, alert.

**Fixed dialogue**:
A bubble line drawn from the curated, committed line set. Kokoro synthesizes it on demand when live voice is installed.
_Avoid_: static line, scripted line.

**Dynamic line**:
A bubble line composed at runtime from live data (e.g. an achievement label).
_Avoid_: dynamic text, runtime message.

**Voice backend**:
The mechanism that turns mascot feedback into audio: the kokoro-live sidecar, the MiMo bridge, or none (silent, text-only).
_Avoid_: TTS engine, voice provider.

**Kokoro-live sidecar**:
A host-spawned, persistent local kokoro-onnx process exposing a local HTTP endpoint, used to synthesize mascot feedback on demand and cache the audio. Available after local voice setup.
_Avoid_: TTS server, voice daemon.

**MiMo bridge**:
The existing optional integration point — a `dsh-whale-musume:interaction-line` CustomEvent — that an external MiMo TTS integration can listen for.
_Avoid_: TTS event, voice hook.
