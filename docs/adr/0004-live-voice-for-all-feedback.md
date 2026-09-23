# Live Kokoro voice for all mascot feedback

This supersedes ADR 0001's dynamic-only scope. The selected dialogue language now controls both the bubble and its voice, including fixed dialogue, personalized lines, and generated feedback. Kokoro synthesizes on a cache miss; the shipped Japanese clips remain a fallback. The trade-off is a first-play delay and an optional local model setup in exchange for one consistent speech path that can say edited lines and custom names.
