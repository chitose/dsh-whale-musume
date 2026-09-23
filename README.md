<div align="center">
  <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume">
    <img src="docs/images/logo.png" alt="Umika logo" width="128">
  </a>
  <h1>Umika · dsh-whale-musume</h1>
  <p>A desktop mascot (Kanban Musume) plugin for <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>.</p>
  <p>A whale girl who codes alongside you: she idles quietly by your side, and the moment work starts she picks up her laptop and gets busy with you.<br>Headpat her, raise her, unlock achievements, or drag her around the screen. Everything runs locally — no telemetry, no external requests.</p>

  <p>
    <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-2.1.0-4da3ff" alt="version 2.1.0"></a>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/latest"><img src="https://img.shields.io/badge/Download-Latest-31df76" alt="Download latest"></a>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/releases"><img src="https://img.shields.io/github/downloads/Sutera-Diffusus/dsh-whale-musume/total?label=downloads&color=31df76" alt="Total downloads"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6f42c1" alt="MIT license"></a>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/discussions"><img src="https://img.shields.io/badge/Discussions-Chat-blue" alt="GitHub Discussions"></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/DSH-0.1.0--rc.6%20%2B%20(0.1.1--rc.2%20tested)-0078D4" alt="DSH 0.1.0-rc.6+">
    <img src="https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white" alt="Windows">
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18+">
    <img src="https://img.shields.io/badge/Unit%20Tests-102%20passing-31df76" alt="102 unit tests passing">
  </p>

  <p>
    <a href="https://github.com/Sutera-Diffusus/dsh-whale-musume/releases/latest">Download</a>
    ·
    <a href="#preview">Preview</a>
    ·
    <a href="#installation">Installation</a>
  </p>

  <p>
    <a href="README.en.md">Plain-text version</a> · <a href="README.md">Main README</a>
  </p>
</div>

![Umika: here I come!](docs/images/homepage-promo.png)

---

## Table of Contents

- [Features](#features)
- [Preview](#preview)
- [Requirements](#requirements)
- [Installation](#installation)
- [First Run](#first-run)
- [Usage](#usage)
- [Update / Rollback / Uninstall](#update--rollback--uninstall)
- [Data & Privacy](#data--privacy)
- [Project Structure](#project-structure)
- [Development & Testing](#development--testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### 🐋 The Mascot

- Floats on screen by default (200px) and can be dragged with the mouse;
- While dragging, she switches to the "picked up" sprite and sways naturally with the cursor's direction;
- **Drag inertia**: on release she glides a short distance according to her instantaneous velocity and spins back upright, grabbing the screen edge when she reaches it; a gentle release only triggers a small rebound, and her position is saved only after the glide ends;
- While idle she keeps a calm expression and randomly performs small daily actions — sipping coffee, stretching, snacking;
- Transitions between idle and working states use a "squash → swap → bounce" motion cut, so there is no ghosting and no black flashes;
- If you turn her off in settings, a summon button (🐋) stays in the bottom-left corner — one click brings her back; she never "vanishes without a trace".

### 💼 Work-State Integration

- Detects running tools (`data-running` / `data-state="ongoing"`) and automatically switches to the "working with her laptop" pose;
- While working she gains a soft blue glow and a "working" label;
- Clicking her while working randomly triggers a "shy laptop hug" or "sneaking a bite of the RAM stick" reaction, without interrupting the work state; the running pose stays stable instead of randomly switching to idle skits;
- **Tool-type poses**: commands, file edits, search, tests, reviews, deployments and debugging each have their own pose (all reusing existing work sprites — no new assets). Unrecognized tools fall back to the generic working pose instead of guessing.

### 🪙 Balance check-ins

- A new "Balance" group shows the current account balance, with a one-line comment from her (six tiers: very comfortable / comfortable / normal / low / critical / empty, 29 lines);
- Data comes from a **local** balance proxy (`127.0.0.1:3020`, the `dsh-statusbar` balance-proxy). The proxy only listens on 127.0.0.1, never echoes keys, and performs upstream requests server-side — so the browser still only talks to localhost and the "no external requests" promise holds;
- **Off by default**; when enabled it polls every 60 seconds (aligned with the proxy cache). If the proxy is down or returns nothing, it fails silently — no errors, no log spam;
- Keeps the "never intrude while busy" rule: announcements only happen while idle. When the balance is comfortable she barely mentions it; when it's tight she reminds you more often;
- Worried about the amount being visible? Turn off "Show balance digits" and she only speaks in tiers — screenshots never leak your balance.

### 🎨 Sprites & Expressions (90+)

- Full-scene sprites: idle, working, thinking, away, plus zone-interaction sprites for headpat / belly poke / tail poke;
- Growth sprites: level-up, achievement unlocked, daily quest completed, tail wag;
- Four game poses (thinking / pleased / victory / narrow defeat) and three weather poses (umbrella / cold / snowy);
- Automatic festival costumes on Christmas / Halloween / Mid-Autumn / Spring Festival / Valentine's Day;
- 13 meme keyword reactions: kyun, OMG, doge, sike, bowing, peace, doubting life, waku waku and more — matching a keyword transforms her into a reaction image on the spot.

### 💬 Meme Chat & Weather Companion

- 530+ lines covering every scenario: cute first, seasoned with safe memes — office grind, slacking off, deadlines, pie-in-the-sky promises, unhinged literature;
- Proactive small talk every 5–8 minutes, classified locally from the current task so it stays on topic; she never chimes in while working;
- Time-of-day greetings: morning / late morning / noon / afternoon / evening with caring words; she never disturbs you between 23:00 and 5:59;
- Mood-layered lines: gentle when her mood is low, energetic when it's high; bond levels unlock exclusive lines (Lv3 / Lv5 / Lv7);
- Weather companion: Settings → Mascot → Weather, enter a city (API key optional) and test the connection; Open-Meteo is free and needs no key, and leaving the city empty means zero networking;
- Weather visual effects: full-screen ambient effects (rain / snow / lightning / wind / fog / heat wave / frost), switching with the real weather, automatically toned down while working, and toggleable in settings.

### 💗 Proactive Care

- Four proactive care lines: sitting-too-long reminder (busy for 25 minutes straight), late-night rest nudge (still busy after 23:00), stuck companion (same state for 8 minutes), welcome-back greeting (away for over 3 minutes);
- The iron rule is "keep you company, never command" — she **never interrupts while working**, and her lines remind rather than push (19 lines in total);
- Care events are at least 15 minutes apart so they never become noise; the whole feature can be turned off in settings.

### ♿ Accessibility Mode

- By default the desktop pet is pure decoration (`aria-hidden`); with accessibility mode enabled she can be focused with Tab, headpatted with Enter/Space, and nudged with the arrow keys (Shift accelerates), with state changes announced via `aria-live`;
- Uses `role="button"` with a dynamic aria-label (including your custom name for her) and a visible focus outline;
- **Off by default**: it adds no burden to the default experience, but keeps a path open for those who need it.

### 🎀 Interactions & Effects

- Single-click headpat: blushing sprite + floating hearts/stars emoji;
- Zone interactions: clicking different parts of her (head / belly / tail) has dedicated sprites, effects and lines;
- Keyword expressions: when the chat hits one of the 13 meme keywords, Umika transforms into a reaction image live;
- Triple-click: starry-eyed celebration + particle effects + spin animation;
- Right-click menu: feed / poke / praise / mini-game: Bubble Pop / back to home position / open settings;
- Click reactions switch instantly, with no sluggish transitions.

### 🫧 Mini-Game "Bubble Pop · Bubble Party"

- 4×4 bubble grid with normal / star / bomb bubbles, combo scoring, and three-tier results per 30-second round;
- Playable by mouse click or keyboard (arrow keys to move the cursor, Enter to pop, Esc to quit) — both paths work;
- Daily progression rewards are capped at 3 rounds; extra rounds only count score without farming affection;
- Playable while working or with the settings page open; only pauses when the page is hidden;
- New records, combos and first wins each have dedicated achievements.

### 📈 Progression & Achievements

- Mood, affection, fullness, level, check-in streak and total companionship time;
- Daily quests: 3 quest slots refreshed daily, with affection rewards on completion;
- Weekly check-in: a 7-slot weekly board with milestone rewards at 1 / 3 / 7 days;
- Bond-level unlocks: Lv3 new idle action, Lv5 title "Whale Tide Guardian", Lv7 hidden easter egg;
- 39 achievements across interaction, companionship, DSH usage, mini-games and quests;
- A built-in **achievement wall** in the settings panel — unlocked ones highlighted, locked ones greyed out;
- **Growth diary**: key moments (bond level-ups, achievement unlocks) recorded by time, shown in reverse order in the settings panel (the latest 12 with relative time); only one entry per event type per day, capped at 80 entries, all kept locally.

### 🌗 Theme Adaptation

- Follows the host dark/light theme: detects DSH's `data-theme` / `dark` class, falling back to the system `prefers-color-scheme`;
- Only affects UI elements like the bubble and menus — **sprites are never filtered** and the art style never changes;
- Writes only on theme changes; no per-frame probing.

### ⚙️ Settings Panel

- Mascot settings are integrated into the DSH settings page;
- Collapsible groups: Companion / Weather / Balance / Daily & Growth / Achievement Wall / Growth Diary / Data & Reset, with the overview card and group cards aligned to equal width;
- Pill toggles: mascot / speech bubble / voice / particle effects / mini-game / keyword awareness / slack-off reminder / late-night mode / weather effects / tool-type poses / drag inertia / proactive care / accessibility / balance care / show balance number;
- Off by default: line narration, keyword awareness (involves reading chat content), accessibility, balance care, show balance number (involves your account balance);
- **Live Kokoro voice:** run `npm run setup:voice` once and restart DSH Web. Choose English or Japanese in Mascot settings; bubbles and speech use that language. New lines are synthesized locally and cached across restarts, with a 500 MB limit and a clear control. The 654 bundled Japanese clips remain a fallback;
- Mascot settings shows voice setup status. The optional `dsh-xiaomi-tts` bridge can speak lines when live voice and a bundled clip are unavailable;
- Daily & Growth uses tabs: Today's Quests / Weekly Check-in / Titles, managed alongside the achievement wall;
- The overview card lets you edit "How to address me" and **"her self-name"** — leave the latter empty and she defaults to "Umika"; every self-reference is then replaced consistently across all 385 occurrences in her dialogue library;
- Growth data is displayed as compact horizontal cards with sensible information density.

### 🧩 Engineering

- Pure frontend injection; never modifies DSH business DOM;
- Every change can be backed up and rolled back;
- Asset files carry version numbers, forcing a cache refresh after upgrades;
- **Sprite preloading**: only 5 frequently-used poses load on first paint; the other 90+ are fetched one at a time every 120ms during idle (preferring `requestIdleCallback`), so cold-start pose switches never stutter and preload failures are completely silent;
- The core state machine is separated from the presentation layer, making secondary development easy.

---

## Preview

> The screenshots below are real captures of the plugin running inside DSH. The sprite overview boards live in `docs/images/`.

### Running Screenshots

| Scene | Description |
| --- | --- |
| <img src="docs/images/preview-idle-coffee.png" alt="Idle companion: coffee break" width="560"> | **Idle companion**: floats in the bottom-right corner by default, quiet and unobtrusive; random daily actions like sipping coffee or stretching while idle. [View full image](docs/images/preview-idle-coffee.png) |
| <img src="docs/images/preview-working.png" alt="Working state: laptop out, coding with you" width="560"> | **Work-state integration**: automatically switches to "working with her laptop" when a tool runs, with a soft blue glow; no small talk and no interruptions while working. [View full image](docs/images/preview-working.png) |
| <img src="docs/images/preview-headpat.png" alt="Headpat: speech bubble feedback" width="560"> | **Headpat**: a single click triggers dedicated sprite and a speech bubble — "It feels nice, but you'll mess up my hair💢". [View full image](docs/images/preview-headpat.png) |
| <img src="docs/images/preview-feeding.png" alt="Feeding: snacking reaction" width="560"> | **Feeding**: right-click → feed a snack to raise fullness and affection, triggering the eating sprite — "Nom — delicious!" [View full image](docs/images/preview-feeding.png) |
| <img src="docs/images/preview-idle-sparkle.png" alt="Floating form with sidebar collapsed" width="560"> | **Floating form**: 200px default size, freely draggable with the position saved on release; right-click → back to home position in one click. [View full image](docs/images/preview-idle-sparkle.png) |

### Sprite & Poster Overviews

| Type | File |
| --- | --- |
| 24-pose showcase | `docs/images/showcase-board.png` |
| New sprite showcase (19) | `docs/images/new-poses-board.png` |
| Key interaction actions | `docs/images/actions-board.png` |
| Official posters v1–v4 | `docs/images/promo-poster-v1.png` ~ `promo-poster-v4.png` |

---

## Requirements

| Item | Requirement |
| --- | --- |
| Operating system | Windows 10 / 11 (development and test environment) |
| Node.js | 18+ (needed to run the install scripts; not needed for the bundle install) |
| DeepSeek Harness | `0.1.0-rc.6` and above; the settings panel is adapted to and tested on `0.1.1-rc.2` |
| Browser | Latest Edge / Chrome |

> The script install modifies frontend asset files inside the DSH installation directory. The script makes backups, but it is still recommended to close the DSH page before installing and note down your current DSH version. For a fully non-invasive install, use the bundle method.

---

## Installation

Umika offers two installation methods. **Pick one — do not mix them:**

| Method | How it works | Best for |
| --- | --- | --- |
| **A. Bundle install (recommended)** | A standard DSH bundle declaring `dsh.bundle.patch`; the settings panel is registered through the `settings.section` slot; no built-in package files are rewritten | Regular users; DSH 0.1.1-rc.2 and above |
| **B. Script install** | An install script injects the frontend assets and settings panel, with automatic backup and rollback | Theme-integration scenarios; older DSH versions |

### Method A: Bundle Install (non-invasive, recommended)

Umika also ships as a standard DSH bundle that can be installed directly via `dsh plugin` or a plugin marketplace (e.g. mydsh.dev):

```powershell
dsh plugin --profile web add github:Sutera-Diffusus/dsh-whale-musume
```

After installing, restart `dsh web` and hard-refresh the page (`Ctrl+F5`) — Umika appears automatically. This mode:

- The host plugin only registers a read-only static asset route `/api/dsh-whale-musume/assets`, serving styles/scripts/sprites to the browser;
- The browser plugin injects Umika herself; all assets come from the local machine — no external requests, no telemetry;
- Toggles and mode preferences live in Umika's own gear menu (localStorage, `whale-moe:*` keys);
- The "Mascot" settings panel (pill toggles / growth data / achievement wall / weather) is registered into the DSH settings page by the browser plugin through the `settings.section` slot — **no built-in package files are rewritten**, so it also works on 0.1.1-rc.2 and above;
- Compatibility fallback: if the `slots` service is missing or a sub-slot fails to render, the settings panel falls back to its built-in renderer and the desktop pet itself is unaffected.

### Method B: Script Install

#### Step 1: Get the plugin

**Download a Release (recommended)**

1. Open [Releases](https://github.com/Sutera-Diffusus/dsh-whale-musume/releases);
2. Download the latest `dsh-whale-musume-plugin-vX.Y.Z.zip`;
3. Extract it anywhere, e.g. `D:\dsh-whale-musume`.

**Or clone the repository**

```powershell
git clone https://github.com/Sutera-Diffusus/dsh-whale-musume.git
cd dsh-whale-musume
```

#### Step 2: Confirm the DSH install directory

The DSH installation directory usually contains `DeepSeekHarness-Launcher.exe` and `node_modules`. If you are not sure, check the launcher config:

```powershell
Get-Content "<DSH_INSTALL_DIR>\DeepSeekHarness-Launcher.cfg"
```

The `workDir` field points to the installation directory. Below, `<DSH_INSTALL_DIR>` stands for that path.

#### Step 3: Run the install script

Open PowerShell in the plugin directory and run:

```powershell
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>"
node scripts/apply-theme.mjs --mascot-settings --target "<DSH_INSTALL_DIR>"
```

You can also pass the directory via an environment variable:

```powershell
$env:DSH_INSTALL_DIR = "<DSH_INSTALL_DIR>"
node scripts/apply-theme.mjs --assets-only
node scripts/apply-theme.mjs --mascot-settings
```

The `Backup:` path in the script output is the backup directory for this run — keep it until you have confirmed the plugin works correctly.

#### Step 4: Refresh the DSH page

1. Open the DSH web page (default `http://127.0.0.1:3080`);
2. Hard refresh: `Ctrl + F5`;
3. Once the page finishes loading, Umika should appear in the bottom-right corner.

---

## First Run

After installation, verify the core features in this order:

1. **Click Umika**: you should see a blush/hearts effect;
2. **Click three times in quick succession**: you should see a starry-eyed celebration + particle effects;
3. **Drag Umika**: she should switch to the "picked up" sprite and sway with the cursor, and her position should be saved on release;
4. **Right-click Umika**: you should see the menu — feed / poke / praise / Bubble Pop mini-game / back to home position / open settings;
5. **Open DSH Settings → Mascot**: you should see the pill toggles, growth data and the achievement wall;
6. **Run a tool call**: Umika should automatically switch to "working with her laptop" with a soft blue glow.

Once all of the above pass, you can fill in a city under Settings → Mascot → Weather to turn on the weather companion, or start your progression journey with the daily quests.

---

## Usage

### Dragging

- Hold and move Umika; her position is saved automatically on release;
- Right-click Umika → **Back to home position** restores the default bottom-right spot.

### Right-Click Menu

| Item | Description |
| --- | --- |
| Feed a snack | Raises fullness and affection |
| Poke | Lowers mood and triggers the annoyed sprite |
| Praise Umika | Raises mood and affection, triggers starry eyes |
| Back to home position | Clears the saved floating position |
| Open mascot settings | Jumps to the DSH settings page |

### Settings Panel

Path: DSH Settings → **Mascot**.

| Group | Contents |
| --- | --- |
| Companion | How to address me, mascot toggle, speech bubble, optional MiMo TTS line narration, particle effects, keyword awareness, slack-off reminder, late-night mode, tool-type poses, drag inertia, proactive care, accessibility |
| Weather | Weather city, optional API key, weather effects toggle |
| Balance | Balance alerts toggle, show-balance-digits toggle, current balance and tier (off by default) |
| Daily & Growth | Three tabs: Today's Quests / Weekly Check-in / Titles |
| Achievement Wall | 39 achievements — unlocked highlighted, locked greyed out |
| Growth Diary | Key moments such as bond level-ups and achievement unlocks, latest 12 in reverse order |
| Data & Reset | Reset floating position, reset growth data |

---

## Update / Rollback / Uninstall

### Update

**Bundle method**: update to the latest version via `dsh plugin`, then restart `dsh web` and hard-refresh.

**Script method**:

1. Download the new plugin zip and overwrite `assets/` and `scripts/` in the old directory;
2. Re-run the two install commands from Method B, Step 3;
3. Hard-refresh the page.

### Rollback

The install script generates a backup in the `DSH_WHALE_BACKUP` directory (default `<BACKUP_DIR>`):

```powershell
node scripts/apply-theme.mjs --rollback "<backup dir>"
```

### Uninstalling the Mascot

**Bundle method**: remove it via `dsh plugin` — no rewritten files are left behind.

**Script method**:

```powershell
node scripts/apply-theme.mjs --mascot-settings --target "<DSH_INSTALL_DIR>" --rollback <settings backup dir>
node scripts/apply-theme.mjs --assets-only --target "<DSH_INSTALL_DIR>" --rollback <assets backup dir>
```

Or simply turn off the "Mascot" toggle in the settings panel (assets stay in place and can be re-enabled anytime; a summon button 🐋 appears in the bottom-left corner while she is off).

---

## Data & Privacy

- All state is stored in the browser's `localStorage` under keys starting with `whale-moe:`;
- Contains no API keys or user credentials;
- No telemetry, no data uploads, no external network access;
- The install script only reads DSH frontend asset files and writes backups; it never reads DSH session data;
- Weather is **optional**: an empty city means zero networking; once a city is set, it defaults to the free Open-Meteo API (no key needed);
- Balance is **off by default**: even when enabled it only talks to the local balance proxy (`127.0.0.1:3020`); the proxy never echoes keys and the browser side makes no external requests; with "Show balance digits" off, the UI only shows tier wording, so screenshots never leak amounts.

---

## Project Structure

```text
dsh-whale-musume/
├─ assets/
│  ├─ dsh-whale-moe.css          # Mascot styles and animations
│  ├─ dsh-whale-moe.js           # DOM presentation layer, state scheduling, interactions, voice playback
│  ├─ whale-moe-core.js          # Pure-function state machine (unit-testable)
│  ├─ peek-calibration.json      # Peek-pose calibration data
│  ├─ generated/                 # 90+ sprites (states / interactions / growth / games / weather / festivals / expressions)
│  └─ voice/ja/                  # Generated voice pack: 654 Ogg Vorbis clips + manifest.json (15.7 MB)
├─ scripts/
│  ├─ apply-theme.mjs            # Install / rollback / settings injection
│  ├─ voice-pilot.mjs            # Voice: line selection, translation store, job builder
│  ├─ kokoro-render.py           # Voice: Kokoro synthesis with format / silence / vocabulary assertions
│  ├─ voice-pack.py              # Voice: compression with a per-file SNR gate
│  ├─ gen-assets.py              # Sprite generation pipeline (calls a third-party image API; keys via environment variables)
│  ├─ build-assets.py            # Sprite asset build
│  ├─ build-review.py            # Generates the sprite review page
│  └─ slice-batch.py             # Poster slicing
├─ test/
│  ├─ whale-moe-core.test.mjs
│  ├─ whale-moe-growth.test.mjs
│  ├─ whale-moe-game.test.mjs
│  ├─ whale-moe-fx.test.mjs
│  ├─ whale-moe-quest.test.mjs
│  ├─ whale-moe-zones.test.mjs
│  ├─ apply-theme.test.mjs
│  ├─ voice-pack.test.mjs        # Voice pack coverage, URL contract, playback behaviour
│  ├─ voice-browser-check.mjs    # Voice end-to-end check in headless Chrome (npm run qa:voice)
│  ├─ cdp-whale-moe.mjs
│  ├─ motion-qa.mjs
│  ├─ soak-work.mjs
│  ├─ showcase-poses.mjs
│  └─ showcase-actions.mjs
├─ docs/
│  ├─ voice-pipeline.md          # How to change a translation and regenerate the voice
│  └─ images/                    # Logo, running screenshots and sprite overview boards
├─ LICENSE
├─ README.md
├─ README.en.md
├─ CHANGELOG.md
├─ SECURITY.md
└─ CONTRIBUTING.md
```

---

## Development & Testing

```powershell
# Unit tests (122)
npm test
# or equivalently:
node --test test/whale-moe-core.test.mjs test/whale-moe-growth.test.mjs test/apply-theme.test.mjs test/whale-moe-game.test.mjs test/whale-moe-fx.test.mjs test/whale-moe-quest.test.mjs test/whale-moe-zones.test.mjs

# Voice end-to-end (needs Chrome/Edge; Node 22+ for the global WebSocket)
npm run qa:voice          # headless, asserts that playback really advances
npm run qa:voice:watch    # the same in a visible, audible window

# Motion quality check (needs a test DSH copy running on port 3181)
node test/motion-qa.mjs

# Full CDP acceptance (needs a DSH copy + Chrome/Edge CDP on 9223)
node test/cdp-whale-moe.mjs
```

It is recommended to develop against a separate DSH copy to avoid polluting your main installation.

Regenerating the Japanese voice (translations, new lines, a different voice) is documented in [`docs/voice-pipeline.md`](docs/voice-pipeline.md).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No whale after refresh | Confirm the install command output `Applied` (bundle method: confirm the plugin is enabled); hard-refresh; check the "Mascot" toggle in the settings panel |
| Turned her off in settings and can't find her | There is a summon button (🐋) in the bottom-left corner — click it to call her back |
| Images don't update | Hard-refresh (`Ctrl+F5`); asset URLs carry version numbers — if the browser cache is stale, clear the site cache |
| No "Mascot" section in settings | Script method: run `--mascot-settings` and refresh; bundle method: confirm DSH is 0.1.1-rc.2+; check DSH version compatibility |
| Accidental drags | A single click never starts a drag; movement must exceed 4px to enter drag mode |
| Some bubbles have no voice | Check Kokoro status in Mascot settings and run `npm run setup:voice` if needed. `__dshWhaleVoice` in the browser console records fallback clip misses and autoplay blocks. See [docs/voice-pipeline.md](docs/voice-pipeline.md) |
| Want to restore the default position | Right-click → Back to home position |
| Mixed the two install methods | Fully uninstall/rollback with the corresponding method first, then reinstall with just one of them |

---

## License

[MIT](./LICENSE)

---

**Umika keeps you company while you code — and while you slack off.** 🐳
