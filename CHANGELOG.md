# Changelog

## v2.2.0 (2026-09-21)

- **Bundled Japanese voice**: all 653 dialogue lines plus her celebration line are pre-rendered with Kokoro-82M (`jf_tebukuro`) and ship as Ogg Vorbis under `assets/voice/ja/` — 15.7 MB for 64 minutes of audio, 21–23 dB SNR against the WAV masters. A new **"Japanese voice"** toggle (on by default) speaks every line that appears in a bubble; it follows the "Dialogue bubbles" toggle. A line with no clip (dynamically composed announcements such as "Achievement unlocked: …") falls through to the optional MiMo TTS bridge, so the two never speak over each other. Browser autoplay refusals are swallowed and re-armed on the next user gesture. A clone without the generated pack installs and behaves exactly as before
- **Fix: some bubbles never spoke** (reported from a live test): the reconcile loop writes two bubbles directly rather than through `showLine()` — the per-state line (the most-seen bubble of all: idle / thinking / tool / success / failure) and the triple-pat celebration line — and both bypassed the voice dispatch. Both now speak, and the celebration line has a clip of its own
- **Naming no longer mutes the voice**: 74% of clips contain "Master" or "Whale-chan", so the earlier rule (stay silent when a custom address or self-name is set) silenced three quarters of the library and looked like a bug. The clips still carry the built-in names, and the bubble keeps yours
- **Silent bubbles are now diagnosable**: `window.__dshWhaleVoice` reports the manifest state and the last 20 lines that were not voiced, each with a reason (`not-in-pack`, `autoplay-blocked`, `autoplay-refused`, `manifest-not-loaded`, `voice-off`, `bubbles-off`, `playback-error`)
- **Fix: an interrupted clip disabled the voice**: replacing `src` while `play()` is still pending rejects with `AbortError` ("interrupted by a new load request"), which the refusal handler mistook for an autoplay-policy block and then silenced every later line until the next click. Refusals are now classified (policy vs. superseded) and only a policy refusal disarms playback; the browser check runs a regression test for it
- **Tooling**: `scripts/voice-pilot.mjs` (line selection, translation store, batch/merge, model download), `scripts/kokoro-render.py` (kokoro-onnx rendering with format, silence and vocabulary assertions) and `scripts/voice-pack.py` (compression with a per-file SNR gate). Codec choice is measured, not assumed: libsndfile's Opus encoder produces ~7 dB SNR even at 260 kbps, so the pack uses Vorbis
- **`npm run qa:voice`** (`test/voice-browser-check.mjs`): a headless-Chrome end-to-end check that boots the presenter on a fixture page and asserts the manifest fetch, the clip requested for a real line, the URL/file mapping, an advance in playback (`currentTime > 0`, i.e. Chromium really decoded the Ogg) and that the toggle silences the next line. `npm run qa:voice:watch` runs it in a visible, audible window
- **Docs**: `docs/voice-pipeline.md` is the manual for changing what she says and rebuilding the audio — what is source vs generated, one-time setup, the one-translation recipe, changing the voice/speed, the install-and-refresh matrix, and the traps (the `n`-prefix ordering, English-text-keyed clips, the one-time full `--only-missing` run). `scripts/kokoro-render.py --only-missing` now compares the recorded source text, voice and speed as well as the file size, so an edited translation can no longer be silently reused
- Unit tests **108 → 122**, all green

## v2.1.0 (2026-09-14)

- **Optional MiMo TTS dialogue playback** (Issue #9 / PR #10, thanks @ppy-web): when a `dsh-xiaomi-tts` service is detected, a "dialogue playback" toggle appears, off by default; once enabled it speaks the head, belly, tail, and triple-combo lines. A missing install, missing configuration, or playback failure never affects the original interaction, and async playback rejection protection was added
- **Fix: a dialog could make Whale-chan disappear permanently** (Issue #12 / PR #13, thanks @icemaple77): off-canvas drawers lying entirely outside the viewport are no longer treated as visible dialogs; the settings page and visible-dialog scenarios now switch to a 120px mini in the bottom-right corner instead of hiding her entirely
- **Fix: settings panel registration timing**: declare the `slots` inject per the DSH client convention, avoiding a startup where the service is unavailable and the "mascot" settings section is skipped forever
- **Fix: multi-currency balance misjudgement** (Issue #14 / PR #15, thanks @icemaple77): when DeepSeek returns both USD and CNY accounts, prefer CNY; fall back to the first record when there is no CNY
- **Continuous integration**: added GitHub Actions, running the full test suite on Node.js 18 and 22; unit tests **102 → 108, all green**

## v2.0.1 (2026-09-05)

- **DSH STORE compatibility declaration**: the `dsh.compatibility.dshReleases` field in `package.json` now declares a compatibility matrix version by version — `0.1.1-rc.2` (the actual runtime environment) and `0.1.2-rc.1` (the latest official release) are marked `compatible`, while `0.1.2-alpha.4` / `0.1.2-alpha.5` are marked `unknown`
- Restored the historical lineage to the commit pinned by the store catalog (`a61b09d`, v1.5.0) (main had previously been rebased as a whole, so the candidate was no longer a bounded direct successor of the catalog commit), making the new version satisfy the DSH STORE pinned-source update review
- Note: the `compatible` marking for `0.1.2-rc.1` is an author-level source declaration (the core state machine is DOM-free, the presentation-layer signal detection is resistant to the 0.1.2-rc.1 session-stream rework, and stale state markers on historical cards are already filtered); full runtime acceptance has not yet been run on 0.1.2-rc.1. After upgrading to that version, running `npm test` and `npm run qa` is recommended

## v2.0.0 (2026-08-28)

The contents of the four roadmap versions v1.6.0–v1.9.0 are released together, organized by theme below.

### Balance check-ins (formerly v1.6.0)

- **New · account balance display and playback**: added a "balance" group that shows the current balance and has her explain the situation in one line (five tiers: comfortable / normal / tight / critical / bottomed out, 29 lines in total)
- The data source is the local balance proxy at `127.0.0.1:3020` (the balance-proxy of `dsh-statusbar`). The proxy only listens on 127.0.0.1, never echoes the key, and completes upstream requests on the server side, so **the browser side still only talks to the local machine**, which does not break the "no external requests" promise
- Polls once every 60 seconds (aligned with the proxy cache); **off by default**, and it fails silently when the proxy is not running or no data can be fetched — no error popups, no log spam
- Follows "no showing her face while busy": playback only happens while idle; the comfortable tier is almost never mentioned proactively (once every 6 hours), the tight tier once every 30 minutes
- Amounts are sensitive, so a "show balance digits" toggle is provided; when disabled only the tier wording is shown, so screenshots do not leak the balance
- Low-balance detection is now derived from the real amount, while still reusing the existing `balance-low` pose art and the "🪙 balance critical" achievement

### Asset loading (formerly v1.6.0)

- **New · pose art preloading**: 90+ pose art images previously had no loading strategy at all, so after a cold start the first switch to an unpopular pose would lag. Now only 5 common poses are preloaded on the first screen, and the rest are fetched one at a time every 120ms during idle periods, avoiding dozens of simultaneous requests competing for bandwidth
- `requestIdleCallback` is preferred, degrading to a 2.5-second delayed start when unsupported; prefetch failures are completely silent and never affect the normal display path

### Tool-type breakdown (formerly v1.7.0)

- **New · switch work pose by tool type**: running commands, editing files, searching, testing, reviewing, deploying, and debugging each have a matching pose, and **all of them reuse the existing work-* pose art in the repository**, adding no new assets
- Recognition reads the tool card text and does keyword matching, **falling back to the generic work pose when recognition fails**, never switching at random because of a wrong guess
- Added a "tool breakdown" toggle (on by default)

### Drag physics (formerly v1.7.0)

- **New · drag inertia**: after release she glides a short distance at the instantaneous velocity and rotates back upright; hitting the screen edge stops her (she "grabs" the edge) and she stops rotating
- A gentle release (velocity too low) only produces a single slight rebound, avoiding a jitter
- The persist point moved to after the physics glide ends, so the final position is what gets saved
- Added a "drag inertia" toggle (on by default)

### Proactive care (formerly v1.8.0)

- **New · four proactive care tracks**: sedentary reminders (25 minutes of continuous busyness), late-night rest prompts (still busy after 11pm), stuck-company (the same state stalls for 8 minutes), and welcome-back greetings (away for more than 3 minutes)
- The iron rule is "keep company, don't give orders" — **she never interrupts during work states**; care events are at least 15 minutes apart so they do not become noise
- The lines are worded as reminders rather than nagging, 19 in total
- Added a "proactive care" toggle (on by default)

### Accessibility (formerly v1.8.0)

- **New · optional accessibility mode**: the desktop pet was originally pure decoration with `aria-hidden`, completely imperceptible to screen-reader users. Once enabled, she can be focused with Tab, petted with Enter/Space, and nudged with the arrow keys (Shift to speed up), with state changes announced via `aria-live`
- Uses `role="button"` plus a dynamic aria-label (including the custom self-name), with a visible focus ring
- **Off by default**: it adds no burden to the default experience while leaving a path open for those who need it

### Growth diary (formerly v1.9.0)

- **New · growth diary**: progression data could previously only be reset, never reviewed. Now key milestones (bond level-ups, achievement unlocks) are recorded by time, and the settings panel has a new "growth diary" group showing the 12 most recent entries in reverse order with relative timestamps
- Only one entry is recorded per event type per day to avoid flooding; at most 80 entries are kept, all in localStorage

### Theme adaptation (formerly v1.9.0)

- **New · follow the host's dark/light theme**: detects DSH's `data-theme` / `dark` class, falls back to the system `prefers-color-scheme`, and writes the result to `data-wm-theme`
- Only affects UI elements such as bubbles and menus — **no filters are applied to the pose art**, to avoid ruining the art style
- Written only when the theme changes, with no per-frame detection

### Tests

- Unit 99 → **102, all green** (1 new balance tier item, 1 amount formatting item, 1 new dialogue library completeness item)

## v1.5.0 (2026-08-28)

- **New · custom mascot self-name** (issue #4, @Vulpexl): the overview card in the settings panel gains a "her self-name" input paired with the existing "what should I call you"; leaving it blank or clearing it falls back to the default "Whale-chan". Every self-name occurrence in the dialogue library (363 at the time of the Chinese release, 385 after the English translation) is substituted uniformly at the output point rather than rewritten line by line
- **New · recovery entry point after closing** (issue #5, @VectorAC): after turning the mascot off in settings, a recall button (🐋) appears in the bottom-left corner; clicking it calls her back and the button disappears immediately. Scenarios where she is auto-hidden because of the page (such as the settings page) do not show the button, to avoid intruding
- Implementation: name/self-name substitution was extracted into the pure core function `applyNames(line, title, selfName)` (the core still never touches localStorage, with storage reads left in the presentation layer), for easier unit testing and reuse
- Tests: unit 97 → 99, all green (8 new assertions for self-name substitution + 1 for dialogue library default self-name coverage)

## v1.4.2 (2026-08-28)

- **Fix: staying forever on the "crash" pose art after an error** (PR #7, wrzrmzx): `errorVisible()` used to treat any error node appearing after startup as a permanently "live error", while DSH keeps the error cards of failed steps, so Whale-chan was pinned to the failure pose art forever. It now decides the page has turned based on "does the conversation keep progressing after the error" (new `ERROR_MIN_MS = 3000` minimum reaction duration); a new `SETTLE_MS = 10000` load-period settlement window was also added, so historical error cards asynchronously mounted after a refresh are not misjudged as live errors
- Fixed "open mascot settings" doing nothing (PR #2, haitang1): the context menu used to look up the button by the text "settings", while the new DSH settings entry is a pure icon button (`[data-slot="sidebar.settings"] button`); it now performs a three-level lookup: structural slot → `settings.trigger` host button → text fallback
- The bundle install path now provides the "mascot" settings panel (PR #2, haitang1): `lib/client.js` registers `settings.section` (id=mascot, label=mascot), with contents from the same source as `--mascot-settings` v27 (overview card / companionship display toggles / weather / daily and progression / achievement wall / data and reset), reading `whale-moe:*` localStorage and staying in live sync with the desktop pet itself
- **Adapted to DSH 0.1.1-rc.2**: the settings panel is now registered through the `settings.section` slot rather than relying on rewriting the dist file of `@deepseek-ai/dsh-client-ui-theme` (that directory was removed in 0.1.1-rc.2, so the old patch path is completely dead)
- Settings panel robustness hardening: when `renderSlot` is missing or throws, it falls back to the built-in `MascotPrefRows` so the panel is never blank; when the `slots` service is unavailable or registration fails, the panel is skipped and the desktop pet itself is preserved
- Compatibility statement updated: the README now notes that DSH 0.1.1-rc.2 has been tested in practice
- Tests: all 97 unit tests green

## v1.4.1 (2026-08-18)

- Settings panel v27: the top overview outer card width was adjusted to 95% centered, visually aligning with the collapsible group outer cards below (finalized)

## v1.4.0 (2026-08-18)

- Fixed the mini game being "unplayable": the pause condition was narrowed to page hidden only, so it is no longer wrongly paused during work states or while the settings page is open; the game panel role was corrected so it is no longer misjudged as a settings view
- Major pose art expansion (45 new, 90+ total): thinking / away / tool tri-state, head / belly / tail zoned interactions, four growth states (level-up / achievement / daily complete / tail flick), four game states, three weather states, five holiday sets (Christmas / Halloween / Mid-Autumn / Spring Festival / Valentine's Day), and 13 meme expressions
- New interaction · zoned clicking: three zones — head / belly / tail — each with its own pose art, effects, and dialogue lines
- New interaction · keyword expressions: chat hits on 13 meme keywords (kyun / OMG / doge / sike / worship / peace / existential crisis / waku waku and others) automatically transform her into a reaction image
- New feature · automatic holiday outfits: on Christmas / Halloween / Mid-Autumn / Spring Festival / Valentine's Day, the holiday pose art switches automatically
- Settings panel v24 rework: collapsible groups (companionship display / weather / daily and progression / achievement wall / data and reset), tabbed sections (today's tasks / this week's check-in / titles), overview card and group cards aligned at equal width
- Tests: unit 73 → 97, all green (16 new assertions for poke zones / holidays / keyword lexicon)

## v1.3.0 (2026-08-18)

- New feature · interactive mini game "Poke Bubbles · Bubble Party": entered from the context menu, 4×4 grid reachable with the keyboard arrow keys; three bubble types (normal / star / bomb), combo bonuses, three settlement tiers in a 30-second round; a daily cap of 3 rounds of progression rewards to prevent farming; 4 new achievements
- New feature · deeper progression gameplay: daily tasks (3 slots auto-refreshed, check-in always present), 7-day weekly check-in milestones (rewards at 1/3/7 days), bond level unlocks (Lv3 new idle animation / Lv5 title "Whale Tide Guardian" / Lv7 easter egg); three new cards in the settings panel: "today's tasks", "this week's check-in", "titles"; 5 new achievements
- New feature · weather visual effects: full-screen canvas ambient effects in 9 categories × 3 tiers (rain / snow / lightning / wind / fog / heat wave / frost mist / overcast / clear), deriving hot/cold/wind from temperature and wind speed on the fly (fixing dead code the tri-state lexicon had never reached); the weather card gains a "weather effects" toggle (on by default); tiers automatically drop during work states, lightning is muted, effects pause while the page is hidden, and the performance budget caps at 160 particles
- Layered mood lines: mood <40 low-spirited lines, ≥70 upbeat lines; new bond lexicon (5 lines each for Lv3/Lv5/Lv7 + 5 each for high/low mood)
- Teasing dead code revived: low-frequency snark while idle in non-workbench views (does not enter the state machine, so the stable work-state rules are unchanged)
- Lexicon expanded to 530+ lines; achievement wall 30 → 39
- Settings panel marker v12 → v13 (older versions upgrade automatically with zero migration; new mini game / weather effects toggles)
- Tests: unit 42 → 73, all green; full CDP plus 8 new assertions all green; motion-qa / soak-work regressions remain green

## v1.2.0 (2026-08-17)

- Added the standard bundle package form: package.json declares dsh.bundle.patch + dsh.client.platform: web, installable via dsh plugin --profile web add github:Sutera-Diffusus/dsh-whale-musume or the plugin marketplace (with strict validation through mydsh.dev)
- Added the host plugin lib/index.js: a read-only static asset route /api/dsh-whale-musume/assets (with path traversal protection, MIME, and cache headers) that modifies no built-in package files
- Added the browser plugin lib/client.js: inject styles → state machine → presentation layer, with the asset root rewritten to the host route and duplicate-bootstrap protection
- Bundle mode verification: a real DSH 0.1.0-rc.6 (3181 test copy) install + restart + full CDP acceptance passed 38/38, with zero console errors
- README gained a "bundle installation" section and corrected the settings panel description (bundle mode ships its own panel, confirmed by testing)

## v1.1.5 (2026-08-16)
- Fixed the fresh-install experience: `apply` no longer registers the "Whale-chan · Ocean Dessert Workshop" theme option, so a fresh install is pure desktop pet mode
- Kept the legacy `patchHost/patchClient/untheme` helper functions for cleaning up older versions
- Added an end-to-end acceptance flow "from the Release zip to a fresh DSH copy booting up", with CDP all green

## v1.1.4 (2026-08-16)

- Fixed Whale-chan shrinking in half-screen windows: removed the rule that auto-shrank her to 48px below a ≤980px viewport, so she keeps her normal size at any window width
- Fixed poses freezing because image-swap animations were paused by the browser in background/headless tabs: added a 1.6s timeout fallback that force-lands the loaded new pose
- The installer's backup directory creation now uses recursive, and the default backup location was generalized to the system temp directory
- The CDP narrow-screen assertion changed to "keeps normal size", and the full regression remains green

## v1.1.3 (2026-08-15)

- Fixed "Whale-chan shrinks after code blocks appear": disabled automatic miniaturization for code-heavy content
  - The floating form stays at 200px regardless of code volume, no longer shrinking to 56px
  - The side/bottom forms also no longer shrink because of code blocks, keeping only the narrow-screen (≤980px) adaptation
  - The manual mini form is unaffected (if mini was stored in historical settings)
- New CDP assertions: with 3 code blocks present the size stays normal and there is no dense attribute
- Full regression remains green

## v1.1.2 (2026-08-15)

- Thorough investigation of the idle animation transition chain:
  - Automatic emotions such as insufficient balance now also enter with animation (previously they cut instantly)
  - debug exposes `moodAnimate` for on-site diagnosis
- Added the `mood-churn` stress test: 24 rounds of mixed animation/instant-switch interruptions, 117 sampled frames, no blank frames, no ghosting, no freezing, finally settling back to idle-cute; passed 5 rounds in a row
- Full regression (42 unit tests + motion QA + soak + CDP) remains green

## v1.1.1 (2026-08-15)

- Unified the self-name to "Whale-chan", removing the mixed use of DS-chan / Whale-chan
- Idle daily actions (such as bringing coffee) regained the "press down → swap image → spring up" transition on entry, no longer switching instantly
- The settings panel and theme name were synchronized to Whale-chan
- motion QA gained a regression assertion that "idle actions must enter with animation"

## v1.1.0 (2026-08-15)

- Total lines expanded to 494: state/daily/work/interaction coverage across all scenarios
- New meme keywords: wage slave, slacking off, DDL, empty promises, unhinged lit, flag-raising, bug mysticism
- New task-topic lines (writing code/writing/research/fixing bugs/data/deployment) plus weather lines and time-based greetings
- 5–8 minute proactive small talk: greeting/weather changes > on-topic task remarks > general memes, never interrupting during work states
- Weather companionship: the settings panel gains city, optional API Key, and test connection; Open-Meteo is free and needs no key, and an empty city means zero networking
- No proactive greetings late at night from 23:00–5:59; the stable work-state rules are unchanged

## v1.0.2 (2026-08-15)

- The layout layer now intercepts mood poses too: when busy, `statePose()` no longer lets any mood override running (v1.0.1 only intercepted the render layer, leaving paths that still slipped through)
- Removed the random `teasing` state flicker: idle stably stays at `idle-cute` under any random number
- The work-release path is fixed to running → success → idle, with no bouncing back or intermediate blank frames
- Added the `soak-work` 60s stress test: 6s signal gaps ×5, 24 rounds of rapid flickering, forcing moods in while busy, release and idle stability, all with frame sampling throughout
- motion QA gained prerequisite assertions that "mood must truly complete the layer swap" and "must return to calm before starting"
- The debug panel gained `toolWasActive / lastSuccessAt / toolGoneAt / toolSeenAt` fields

## v1.0.1 (2026-08-15)

- Fixed repeated "twitching" in work states: an interrupted image-swap animation no longer wrongly clears the new animation's re-entrancy marker
- When the work signal briefly disappears and reappears, the work pose stays pinned (8s in the workbench / 4s on other pages)
- Work no longer randomly switches to "work skits", and mood poses give way to running (except for click interactions)
- The low-balance prompt no longer switches poses while busy, showing her face only when idle
- motion QA gained a regression check that "a brief signal disconnection must not flip the pose"

## v1.0.0 (2026-08-15)

- First public release: the Whale-chan mascot plugin
- Floating drag (drag pose + cursor-following sway)
- Idle / work dual states with a 320ms momentum-blocking transition
- Head-pat progression, check-in, companionship time, 30 achievements, achievement wall
- 47 pose art images (including working, reaction images, daily)
- Click emoji/star effects, triple-combo celebration
- Settings panel card layout (basics / smart / progression / achievements / position and data)
