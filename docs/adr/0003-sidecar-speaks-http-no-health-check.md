# Sidecar exposes local HTTP, not stdio; no dedicated readiness check

The host has never spawned a child process before this feature. Considered stdio JSON-RPC vs a local HTTP server for the host↔sidecar protocol. Chose local HTTP: the host already serves HTTP itself (its static asset route in `lib/index.js`), so this reuses a pattern already in the codebase instead of hand-rolling stdio framing.

No separate health/readiness check is done after spawning — the host just calls the sidecar with a short timeout and treats any failure (connection refused, timeout) as "unavailable," falling back to text-only. If the sidecar dies mid-session, it's respawned lazily on the next request rather than monitored. A dedicated readiness protocol would be unneeded complexity given the fallback path already covers "unavailable" for any reason.

Consequence: each synthesis request is tagged with a generation id tied to the bubble line it belongs to. The bubble display is a single-slot queue (a new line replaces the current one before old work necessarily finishes), so a late-arriving response for a superseded line is discarded rather than played over mismatched text.
