#!/usr/bin/env node
// DSH whale-moe theme — idempotent applier for the target DSH install.
//   node scripts/apply-theme.mjs                 # apply to the main install
//   node scripts/apply-theme.mjs --target <dir>  # apply to a specific install
//   node scripts/apply-theme.mjs --rollback <backupDir>
// Every modified file is backed up (original content + SHA-256 manifest) to
//   <BACKUP_DIR>\dsh-whale-moe-<timestamp>\ before the first modification.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_TARGET = process.env.DSH_INSTALL_DIR || "DeepSeekHarness";
const BACKUP_ROOT = process.env.DSH_WHALE_BACKUP || path.join(os.tmpdir(), "dsh-whale-moe-backup");
const MARKER = "DSH-WHALE-MOE-THEME v1";
const PACK_ID = "whale-moe";
const LABEL = "Umika · Ocean Dessert Workshop";

const REL = {
  indexHtml: "node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  themeClient: "node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js",
  themeHost: "node_modules/@deepseek-ai/dsh-client-ui-theme/lib/index.js"
};

const ASSETS = [
  "dsh-whale-moe.css",
  "whale-moe-core.js",
  "dsh-whale-moe.js",
  ...["idle-cute", "curious", "running", "thinking", "afk", "waiting", "success", "failure", "teasing",
      "blush", "angry", "eat", "star", "celebrate", "sleep", "greet", "night", "wink", "bold", "abstract", "work-pat",
      "sweep", "work-slack", "work-ram", "cool-shades", "balance-low",
      "work-idea", "work-deadline", "work-boss", "work-slack-phone", "work-sleep",
      "meme-smug", "meme-cry", "meme-shock", "meme-broke", "meme-yes", "meme-no", "meme-heart", "meme-music",
      "daily-eat", "daily-melt", "daily-shower", "daily-pajama", "daily-coffee", "daily-stretch", "pick-up",
      "react-belly", "react-tail", "react-head", "tail-swing",
      "weather-umbrella", "weather-rain-happy", "weather-snow", "weather-cold", "weather-thunder",
      "levelup", "achievement", "daily-done",
      "game-happy", "game-think", "game-cheat", "game-win", "game-lose",
      "meme-ojisan", "meme-kyun", "meme-wakuwaku", "meme-doge", "meme-smile-pain", "meme-sike", "meme-omg", "meme-doubt", "meme-worship", "meme-peace",
      "festival-spring", "festival-mid-autumn", "festival-halloween", "festival-christmas", "valentine",
      "daily-picnic", "daily-cooking", "daily-fishing", "daily-painting", "daily-gaming",
      "work-meeting", "work-debug", "work-deploy", "work-review", "work-celebrate"].map((state) => `generated/dsh-whale-state-${state}.webp`),
  "generated/dsh-whale-home-peek.webp",
  "generated/dsh-whale-workbench-peek.webp",
  "generated/dsh-whale-settings-peek.webp",
  "voice/ja/translations.json",
  "peek-calibration.json"
];

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, content) { fs.writeFileSync(file, content, "utf8"); }
function sha256(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function timestamp() { return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17); }

function replaceExactlyOnce(source, anchor, replacement, label) {
  const first = source.indexOf(anchor);
  if (first === -1) throw new Error(`${label}: anchor not found`);
  if (source.indexOf(anchor, first + anchor.length) !== -1) throw new Error(`${label}: anchor not unique`);
  return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}

function normalizeRel(rel) {
  return rel.split(path.sep).join("/");
}

export function patchHost(source) {
  if (source.includes(`"${PACK_ID}"`)) return { source, changed: false };
  const simple = '\t"whale-maid"\n];';
  if (source.includes(simple)) {
    return { source: replaceExactlyOnce(source, simple, '\t"whale-maid",\n\t"whale-moe"\n];', "theme host STYLE_PACKS"), changed: true };
  }
  const extended = '\t"whale-maid",';
  if (source.includes(extended)) {
    return { source: replaceExactlyOnce(source, extended, '\t"whale-maid",\n\t"whale-moe",', "theme host STYLE_PACKS (extended)"), changed: true };
  }
  throw new Error("theme host STYLE_PACKS anchor not found");
}

/* Vendor theme-dropdown option strings that patchClient anchors on. Keep the
   quoting and the "})" suffixes intact, and keep these labels in sync with the
   DSH theme locale shipped by the host. */
const CLIENT_ANCHORS = [
  '{ value: "whale-maid", children: "Whale Tide Ceremony" })',
  '{ value: "whale-maid", children: "Victorian Nautical Study" })'
];

export function patchClient(source) {
  if (source.includes('value: "whale-moe"')) return { source, changed: false };
  for (const anchor of CLIENT_ANCHORS) {
    if (!source.includes(anchor)) continue;
    const replacement = `${anchor}, (0, react_jsx_runtime.jsx)("option", { value: "whale-moe", children: ${JSON.stringify(LABEL)} })`;
    return { source: replaceExactlyOnce(source, anchor, replacement, "theme client option"), changed: true };
  }
  throw new Error("theme client option anchor not found");
}

/* ---- mascot-only mode: remove the theme entry but keep the assets ---- */

const MOE_OPTION = `, (0, react_jsx_runtime.jsx)("option", { value: "whale-moe", children: ${JSON.stringify(LABEL)} })`;

export function unpatchClient(source) {
  if (!source.includes('value: "whale-moe"')) return { source, changed: false };
  if (!source.includes(MOE_OPTION)) throw new Error("theme client whale-moe option not found for removal");
  return { source: replaceExactlyOnce(source, MOE_OPTION, "", "theme client option removal"), changed: true };
}

export function unpatchHost(source) {
  if (!source.includes('"whale-moe"')) return { source, changed: false };
  const tail = '\t"whale-maid",\n\t"whale-moe"\n];';
  if (source.includes(tail)) {
    return { source: replaceExactlyOnce(source, tail, '\t"whale-maid"\n];', "theme host STYLE_PACKS removal (tail)"), changed: true };
  }
  const middle = '\t"whale-moe",\n';
  if (source.includes(middle)) {
    return { source: replaceExactlyOnce(source, middle, "", "theme host STYLE_PACKS removal (middle)"), changed: true };
  }
  const leading = '\t"whale-moe",\n';
  throw new Error("theme host whale-moe entry not found for removal");
}

export function patchIndexHtml(source) {
  const marker = `<!-- ${MARKER} -->`;
  if (source.includes(marker)) return { source, changed: false };
  const anchor = '<script src="/assets/dsh-victorian-theme.js"></script>';
  const injection = `${anchor}\n    ${marker}\n    <link rel="stylesheet" crossorigin href="/assets/dsh-whale-moe.css">\n    <script src="/assets/whale-moe-core.js"></script>\n    <script src="/assets/dsh-whale-moe.js"></script>`;
  if (source.includes(anchor)) {
    return { source: replaceExactlyOnce(source, anchor, injection, "frontend index theme scripts"), changed: true };
  }
  console.warn("WARN: victorian script anchor missing; appending before </head>");
  const fallback = `    ${marker}\n    <link rel="stylesheet" crossorigin href="/assets/dsh-whale-moe.css">\n    <script src="/assets/whale-moe-core.js"></script>\n    <script src="/assets/dsh-whale-moe.js"></script>\n  </head>`;
  return { source: replaceExactlyOnce(source, "</head>", fallback, "frontend index head close"), changed: true };
}

export function planWrites(target, assetsOnly = false) {
  const base = path.resolve(target);
  const writes = [];
  const push = (rel, content) => writes.push({ rel, content });
  if (!assetsOnly) {
    push(REL.indexHtml, patchIndexHtml(read(path.join(base, ...REL.indexHtml.split("/")))).source);
    /* Mascot-only install: no theme-pack option is registered. The pure
       patchHost/patchClient/untheme helpers stay exported for legacy installs. */
  }
  const assetsRoot = path.join(base, "node_modules/@deepseek-ai/dsh-web-frontend/dist/assets");
  for (const name of ASSETS) {
    const src = path.join(EXT, "assets", name);
    if (!fs.existsSync(src)) throw new Error(`theme asset missing: ${src}`);
    push(normalizeRel(path.join(path.relative(base, assetsRoot), name)), fs.readFileSync(src));
  }
  return { target: base, writes };
}

export function apply(target = DEFAULT_TARGET, options = {}) {
  const { target: base, writes } = planWrites(target, options.assetsOnly === true);
  const backupRoot = typeof options.backupRoot === "string" && options.backupRoot.length > 0 ? options.backupRoot : BACKUP_ROOT;
  const records = writes.map((item, index) => {
    const dest = path.join(base, ...item.rel.split("/"));
    const originalExists = fs.existsSync(dest);
    const original = originalExists ? fs.readFileSync(dest) : null;
    return {
      ...item, dest, index,
      backupName: originalExists ? `file-${String(index).padStart(2, "0")}-${path.basename(dest)}` : null,
      originalExists,
      originalSha256: original === null ? null : sha256(original),
      patchedSha256: sha256(item.content),
      original
    };
  });
  if (records.every((record) => record.originalExists && record.originalSha256 === record.patchedSha256)) {
    console.log(`[dsh-whale-moe] ${MARKER} is already applied.`);
    return "already";
  }
  const backupDir = path.join(backupRoot, `dsh-whale-moe-${timestamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const record of records) {
    if (record.originalExists) {
      fs.mkdirSync(path.dirname(path.join(backupDir, record.backupName)), { recursive: true });
      fs.writeFileSync(path.join(backupDir, record.backupName), record.original);
    }
  }
  const manifest = {
    marker: MARKER, packId: PACK_ID, target: base, createdAt: new Date().toISOString(),
    files: records.map(({ dest, backupName, originalExists, originalSha256, patchedSha256 }) => ({ dest, backupName, originalExists, originalSha256, patchedSha256 }))
  };
  fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  for (const record of records) {
    fs.mkdirSync(path.dirname(record.dest), { recursive: true });
    fs.writeFileSync(record.dest, record.content);
  }
  console.log(`[dsh-whale-moe] Applied ${MARKER} to ${base}`);
  console.log(`[dsh-whale-moe] Backup: ${backupDir}`);
  return backupDir;
}

const UNTHEME_MARKER = "DSH-WHALE-MOE-UNTHEME v1";

export function planUnwrites(target) {
  const base = path.resolve(target);
  return {
    target: base,
    writes: [
      { rel: REL.themeClient, content: unpatchClient(read(path.join(base, ...REL.themeClient.split("/")))).source },
      { rel: REL.themeHost, content: unpatchHost(read(path.join(base, ...REL.themeHost.split("/")))).source }
    ]
  };
}

export function untheme(target = DEFAULT_TARGET, options = {}) {
  const { target: base, writes } = planUnwrites(target);
  const backupRoot = typeof options.backupRoot === "string" && options.backupRoot.length > 0 ? options.backupRoot : BACKUP_ROOT;
  const records = writes.map((item, index) => {
    const dest = path.join(base, ...item.rel.split("/"));
    const originalExists = fs.existsSync(dest);
    const original = originalExists ? fs.readFileSync(dest) : null;
    return {
      ...item, dest, index,
      backupName: originalExists ? `file-${String(index).padStart(2, "0")}-${path.basename(dest)}` : null,
      originalExists,
      originalSha256: original === null ? null : sha256(original),
      patchedSha256: sha256(item.content),
      original
    };
  });
  if (records.every((record) => record.originalExists && record.originalSha256 === record.patchedSha256)) {
    console.log(`[dsh-whale-moe] ${UNTHEME_MARKER} is already applied.`);
    return "already";
  }
  const backupDir = path.join(backupRoot, `dsh-whale-moe-untheme-${timestamp()}`);
  fs.mkdirSync(backupDir, { recursive: false });
  for (const record of records) {
    if (record.originalExists) {
      fs.mkdirSync(path.dirname(path.join(backupDir, record.backupName)), { recursive: true });
      fs.writeFileSync(path.join(backupDir, record.backupName), record.original);
    }
  }
  const manifest = {
    marker: UNTHEME_MARKER, target: base, createdAt: new Date().toISOString(),
    files: records.map(({ dest, backupName, originalExists, originalSha256, patchedSha256 }) => ({ dest, backupName, originalExists, originalSha256, patchedSha256 }))
  };
  fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  for (const record of records) {
    fs.mkdirSync(path.dirname(record.dest), { recursive: true });
    fs.writeFileSync(record.dest, record.content);
  }
  console.log(`[dsh-whale-moe] Un-themed ${base} (mascot assets kept)`);
  console.log(`[dsh-whale-moe] Backup: ${backupDir}`);
  return backupDir;
}

/* ---- mascot settings section: Umika (mascot) ---- */

const MASCOT_SETTINGS_MARKER = "DSH-WHALE-MOE:MASCOT-SETTINGS v29";
const MASCOT_SETTINGS_LEGACY = ["DSH-WHALE-MOE:MASCOT-SETTINGS v1", "DSH-WHALE-MOE:MASCOT-SETTINGS v2", "DSH-WHALE-MOE:MASCOT-SETTINGS v3", "DSH-WHALE-MOE:MASCOT-SETTINGS v4", "DSH-WHALE-MOE:MASCOT-SETTINGS v5", "DSH-WHALE-MOE:MASCOT-SETTINGS v6", "DSH-WHALE-MOE:MASCOT-SETTINGS v7", "DSH-WHALE-MOE:MASCOT-SETTINGS v8", "DSH-WHALE-MOE:MASCOT-SETTINGS v9", "DSH-WHALE-MOE:MASCOT-SETTINGS v10", "DSH-WHALE-MOE:MASCOT-SETTINGS v11", "DSH-WHALE-MOE:MASCOT-SETTINGS v12", "DSH-WHALE-MOE:MASCOT-SETTINGS v13", "DSH-WHALE-MOE:MASCOT-SETTINGS v14", "DSH-WHALE-MOE:MASCOT-SETTINGS v15", "DSH-WHALE-MOE:MASCOT-SETTINGS v16", "DSH-WHALE-MOE:MASCOT-SETTINGS v17", "DSH-WHALE-MOE:MASCOT-SETTINGS v18", "DSH-WHALE-MOE:MASCOT-SETTINGS v19", "DSH-WHALE-MOE:MASCOT-SETTINGS v20", "DSH-WHALE-MOE:MASCOT-SETTINGS v21", "DSH-WHALE-MOE:MASCOT-SETTINGS v22", "DSH-WHALE-MOE:MASCOT-SETTINGS v23", "DSH-WHALE-MOE:MASCOT-SETTINGS v24", "DSH-WHALE-MOE:MASCOT-SETTINGS v25", "DSH-WHALE-MOE:MASCOT-SETTINGS v26", "DSH-WHALE-MOE:MASCOT-SETTINGS v27", "DSH-WHALE-MOE:MASCOT-SETTINGS v28"];
const MASCOT_SETTINGS_ANCHOR = "}, ThemePackRow));";

function mascotBlock(marker) {
  return `${MASCOT_SETTINGS_ANCHOR}
		/* ${marker} */
		const mascotReact = require("react");
		const MASCOT_NS = "settings.mascot";
		const MASCOT_ROW_STYLE = { alignItems: "center", borderBottom: "1px solid var(--dsw-alias-border-l2)", display: "flex", gap: "12px", justifyContent: "space-between", padding: "10px 0" };
		const MASCOT_CARD_STYLE = { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "10px", padding: "6px 14px", width: "100%" };
		function MascotCard({ title, children }) {
			return (0, react_jsx_runtime.jsxs)("div", { style: MASCOT_CARD_STYLE, children: [(0, react_jsx_runtime.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", fontWeight: "600", padding: "6px 0 2px" }, children: title }), children] });
		}
		function MascotValue(key, fallback) {
			try { const v = window.localStorage.getItem("whale-moe:" + key); return v === null ? fallback : v; } catch (e) { return fallback; }
		}
		function MascotPrefRow({ label, prefKey, compact }) {
			const [isOn, setIsOn] = mascotReact.useState(MascotValue(prefKey, prefKey === "keywords" ? "0" : "1") !== "0");
			return (0, react_jsx_runtime.jsxs)("div", { style: compact ? { alignItems: "center", display: "flex", gap: "8px", justifyContent: "space-between", minWidth: 0, padding: "6px 0" } : MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { style: compact ? { fontSize: "12px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined, children: label }), (0, react_jsx_runtime.jsx)("button", {
				type: "button", role: "switch",
				"aria-checked": isOn,
				style: { alignItems: "center", background: isOn ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-border-l3, #c9cdd6)", border: "none", borderRadius: "999px", cursor: "pointer", display: "flex", height: "24px", justifyContent: isOn ? "flex-end" : "flex-start", padding: "3px", transition: "background 160ms ease", width: "44px" },
				onClick: (event) => {
					event.stopPropagation();
					event.preventDefault();
					const next = !isOn;
					try { window.localStorage.setItem("whale-moe:" + prefKey, next ? "1" : "0"); } catch (e) {}
					setIsOn(next);
					window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: prefKey, value: next ? "1" : "0" } }));
				},
				children: (0, react_jsx_runtime.jsx)("span", { style: { background: "#fff", borderRadius: "50%", boxShadow: "0 1px 3px rgb(0 0 0 / 25%)", height: "18px", width: "18px" } })
			})] });
		}
		function MascotTitleRow({ compact }) {
			return (0, react_jsx_runtime.jsxs)("label", { style: compact ? { alignItems: "center", display: "flex", gap: "12px", justifyContent: "space-between", padding: "2px 0" } : MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "What should I call you" }), (0, react_jsx_runtime.jsx)("input", {
				type: "text",
				defaultValue: MascotValue("title", "Master"),
				maxLength: 8,
				placeholder: "Master",
				style: { flex: 1, maxWidth: "150px", minWidth: 0 },
				onChange: (event) => {
					try { window.localStorage.setItem("whale-moe:title", event.target.value); } catch (e) {}
					window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "title", value: event.target.value } }));
				}
			})] });
		}
		function MascotWeatherRow() {
			const [status, setStatus] = mascotReact.useState("");
			const [busy, setBusy] = mascotReact.useState(false);
			const save = (key, value) => {
				try { window.localStorage.setItem("whale-moe:" + key, value); } catch (e) {}
				window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key, value } }));
			};
			const testNow = () => {
				setBusy(true);
				setStatus("⏳ Connecting to Open-Meteo...");
				const city = window.localStorage.getItem("whale-moe:weatherCity") || "";
				const key = window.localStorage.getItem("whale-moe:weatherKey") || "";
				const p = window.DshWhaleMoeWeatherTest ? window.DshWhaleMoeWeatherTest(city, key) : Promise.reject(new Error("Weather service not ready"));
				p.then((text) => { setStatus(text); setBusy(false); }, (error) => {
					setStatus("❌ Connection failed:" + (error && error.message ? error.message : "Unknown error") + "(works without a key too)");
					setBusy(false);
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
				(0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "Weather city" }), (0, react_jsx_runtime.jsx)("input", {
					type: "text",
					defaultValue: MascotValue("weatherCity", ""),
					placeholder: "e.g. Shanghai (leave empty to stay offline)",
					maxLength: 24,
					onChange: (event) => save("weatherCity", event.target.value)
				})] }),
				(0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "API Key (optional)" }), (0, react_jsx_runtime.jsx)("input", {
					type: "password",
					defaultValue: MascotValue("weatherKey", ""),
					placeholder: "Open-Meteo is free, no key needed",
					maxLength: 128,
					onChange: (event) => save("weatherKey", event.target.value)
				})] }),
				(0, react_jsx_runtime.jsxs)("div", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none", flexWrap: "wrap" }, children: [
					(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px", wordBreak: "break-all" }, children: status }),
					(0, react_jsx_runtime.jsx)("button", { type: "button", disabled: busy, onClick: testNow, children: busy ? "Testing..." : "Test connection" })
				] })
			]});
		}
		function MascotStatRow({ label, value, suffix }) {
			return (0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: label }), (0, react_jsx_runtime.jsx)("span", { children: String(value) + (suffix || "") })] });
		}
		const MASCOT_ACHIEVEMENTS = [
			["first-pat", "🫳", "First Headpat", "Pat Umika's head for the first time"], ["ten-pats", "🖐️", "Ten Pats", "Reach 10 headpats in total"], ["hundred-pats", "💯", "Hundred Pats", "Reach 100 headpats in total"],
			["first-feed", "🍰", "First Snack", "Feed her a snack for the first time"], ["first-triple", "🎉", "Triple Tap", "Trigger the heart-hands easter egg"], ["thanks", "💬", "Sweet Talker", "Say thank you to Umika"],
			["lv5", "⭐", "Level Five", "Reach bond level 5"], ["lv10", "👑", "Level Ten", "Reach bond level 10"], ["signin3", "📅", "Regular", "Check in 3 days in a row"],
			["signin7", "🗓️", "Week Promise", "Check in 7 days in a row"], ["night-owl", "🌙", "Late-night Company", "Interact once between 22:00 and 6:00"], ["comeback", "👋", "Welcome Back", "Come back after being away 2+ hours"],
			["day1", "💞", "One Day Bond", "Umika has kept you company for 1 day"], ["day7", "💎", "One Week Together", "Umika has kept you company for 7 days"], ["day30", "🏛️", "Thirty-day Pact", "Umika has kept you company for 30 days"],
			["first-tool", "🛠️", "Clock In", "See a tool run for the first time"], ["tools-10", "🔧", "Ten Tools", "See tools run 10 times"], ["tools-50", "🏭", "Fifty Tools", "See tools run 50 times"], ["tools-100", "🛰️", "Hundred Tools", "See tools run 100 times"],
			["first-code", "💻", "First Code", "See a code block/terminal for the first time"], ["code-20", "📟", "Code Maniac", "See 20 code blocks/terminals in total"], ["first-success", "✅", "Off to a Flyer", "Complete a task for the first time"],
			["success-10", "🏆", "Ten Wins", "Complete 10 tasks in total"], ["first-failure", "🩹", "First Crash", "Hit a task error for the first time"], ["fail-10", "🚑", "Ten Crashes", "Hit 10 task errors in total"],
			["messages-100", "💌", "Hundred Messages", "See 100 conversation messages"], ["messages-500", "📚", "Five Hundred Messages", "See 500 conversation messages"], ["keyword-master", "🔍", "Keyword Master", "Trigger 10 keyword interactions"],
			["night-work", "🦉", "Late Shift", "Tools still running between 22:00 and 6:00"], ["balance-low", "🪙", "Low Balance", "Trigger a low-balance reminder once"],
			["game-first", "🫧", "First Game", "Finish one round of the mini game for the first time"], ["game-win", "👑", "Bubble King", "Score 300 in a single bubble-pop round"], ["game-combo10", "🔥", "Combo Master", "Reach a 10-hit combo in one round"], ["game-highscore", "🏆", "New Record", "Break your personal high score once"],
			["quest-first", "🎯", "First Quest", "Complete your first daily quest"], ["quest-all", "🎟️", "Perfect Day", "Claim all 3 daily quests in one day"], ["week-signin7", "🏆", "Weekly Perfection", "Fill all 7 slots on this week's check-in board"],
			["bond-action", "🌟", "New Move Unlocked", "Reach bond level 3"], ["bond-badge", "🎖️", "First Title", "Reach bond level 5"]
		];
		function MascotAchievementWall({ ids }) {
			const unlocked = ids.length;
			return (0, react_jsx_runtime.jsxs)("div", { style: { alignItems: "flex-start", display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0 10px", width: "100%" }, children: [
				(0, react_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", width: "100%" }, children: [(0, react_jsx_runtime.jsx)("span", { children: "Achievement wall" }), (0, react_jsx_runtime.jsx)("span", { children: unlocked + " / " + MASCOT_ACHIEVEMENTS.length })] }),
				(0, react_jsx_runtime.jsx)("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: "6px", width: "100%" }, children: MASCOT_ACHIEVEMENTS.map(([id, icon, name]) => {
					const on = ids.indexOf(id) !== -1;
					return (0, react_jsx_runtime.jsxs)("div", { title: name, style: { alignItems: "center", background: on ? "var(--dsw-alias-interactive-bg-hover)" : "transparent", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "2px", opacity: on ? 1 : 0.38, padding: "6px 4px", textAlign: "center" }, children: [(0, react_jsx_runtime.jsx)("span", { style: { fontSize: "16px" }, children: icon }), (0, react_jsx_runtime.jsx)("span", { style: { fontSize: "11px", lineHeight: "14px" }, children: name })] });
				}) })
			]});
		}
		function MascotBar({ label, value, text, max }) {
			const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / (Number(max) || 100) * 100)));
			return (0, react_jsx_runtime.jsxs)("div", { style: { alignItems: "center", display: "flex", gap: "10px", padding: "2px 0" }, children: [
				(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", minWidth: "58px" }, children: label }),
				(0, react_jsx_runtime.jsx)("div", { style: { background: "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "4px", flex: 1, height: "6px", overflow: "hidden" }, children: (0, react_jsx_runtime.jsx)("div", { style: { background: "var(--dsw-static-accent, #4da3ff)", borderRadius: "4px", height: "100%", transition: "width 160ms ease", width: pct + "%" } }) }),
				(0, react_jsx_runtime.jsx)("span", { style: { fontSize: "12px", fontWeight: "600", minWidth: "44px", textAlign: "right" }, children: text })
			] });
		}
		function MascotOverviewCard() {
			const [tick, setTick] = mascotReact.useState(0);
			mascotReact.useEffect(() => {
				const refresh = () => setTick((v) => v + 1);
				window.addEventListener("whale-moe-prefs-change", refresh);
				window.addEventListener("storage", refresh);
				return () => { window.removeEventListener("whale-moe-prefs-change", refresh); window.removeEventListener("storage", refresh); };
			}, []);
			const mood = MascotValue("mood", "70");
			const affinity = MascotValue("affinity", "0");
			const level = MascotValue("level", "1");
			const streak = MascotValue("signinStreak", "0");
			const since = Number(MascotValue("companionSince", ""));
			const days = since > 0 ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
			const chips = [["😊", String(mood), "Mood"], ["💗", String(affinity), "Affection"], ["⭐", "Lv." + level, "Level"], ["📅", streak + " days", "Check-in"], ["⏳", days + " days", "Company"]];
			return (0, react_jsx_runtime.jsxs)("div", { style: { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", margin: "10px auto 0", padding: "8px 14px", width: "95%" }, children: [
				(0, react_jsx_runtime.jsx)("div", { style: { display: "flex", gap: "6px", width: "100%" }, children: chips.map(([icon, value, label]) => (0, react_jsx_runtime.jsxs)("div", { style: { alignItems: "center", background: "var(--dsw-alias-interactive-bg-hover, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "8px", display: "flex", flex: 1, flexDirection: "column", gap: "1px", minWidth: 0, overflow: "hidden", padding: "4px 2px" }, children: [
					(0, react_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", fontWeight: "600", lineHeight: "15px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [icon, " ", value] }),
					(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "10px", lineHeight: "13px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: label })
				] })) }),
				(0, react_jsx_runtime.jsx)("div", { style: { background: "var(--dsw-alias-border-l2)", height: "1px", margin: "8px 0 2px" } }),
				(0, react_jsx_runtime.jsx)(MascotTitleRow, { compact: true })
			] });
		}
		function MascotSwitchGrid() {
			const rows = [
				{ label: "Umika", prefKey: "pet" },
				{ label: "Dialogue bubbles", prefKey: "chat" },
				{ label: "Voice", prefKey: "voiceJa" },
				{ label: "Particles", prefKey: "particles" },
				{ label: "Mini games", prefKey: "game" },
				{ label: "Keyword awareness", prefKey: "keywords" },
				{ label: "Slack-off reminder", prefKey: "idle-nudge" },
				{ label: "Late-night mode", prefKey: "night" },
				{ label: "Weather effects", prefKey: "weatherFx" }
			];
			return (0, react_jsx_runtime.jsx)("div", { style: { display: "grid", gap: "2px 14px", gridTemplateColumns: "1fr 1fr", padding: "2px 0 8px", width: "100%" }, children: rows.map((r) => (0, react_jsx_runtime.jsx)(MascotPrefRow, { key: r.prefKey, label: r.label, prefKey: r.prefKey, compact: true })) });
		}
		function MascotLanguageRow() {
			const [language, setLanguage] = mascotReact.useState(MascotValue("voiceLanguage", "ja"));
			const [voice, setVoice] = mascotReact.useState(MascotValue("kokoroVoice:" + language, language === "ja" ? "jf_tebukuro" : "af_sarah"));
			const voices = language === "ja" ? ["jf_tebukuro", "jf_alpha", "jf_gongitsune", "jf_nezumi"] : ["af_sarah", "af_bella", "af_nicole", "af_sky"];
			mascotReact.useEffect(() => {
				const sync = () => { const next = MascotValue("voiceLanguage", "ja"); setLanguage(next); setVoice(MascotValue("kokoroVoice:" + next, next === "ja" ? "jf_tebukuro" : "af_sarah")); };
				window.addEventListener("whale-moe-prefs-change", sync);
				window.addEventListener("storage", sync);
				return () => { window.removeEventListener("whale-moe-prefs-change", sync); window.removeEventListener("storage", sync); };
			}, []);
			return (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [
				(0, react_jsx_runtime.jsx)("span", { children: "Dialogue language" }),
				(0, react_jsx_runtime.jsxs)("select", { value: language, onChange: (event) => {
					const value = event.target.value;
					setLanguage(value);
					setVoice(MascotValue("kokoroVoice:" + value, value === "ja" ? "jf_tebukuro" : "af_sarah"));
					try { window.localStorage.setItem("whale-moe:voiceLanguage", value); } catch (e) {}
					window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "voiceLanguage", value } }));
				}, children: [(0, react_jsx_runtime.jsx)("option", { value: "ja", children: "Japanese" }), (0, react_jsx_runtime.jsx)("option", { value: "en", children: "English" })] })
			] }), (0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "Kokoro voice" }), (0, react_jsx_runtime.jsx)("select", { value: voices.includes(voice) ? voice : voices[0], onChange: (event) => {
				const value = event.target.value;
				setVoice(value);
				try { window.localStorage.setItem("whale-moe:kokoroVoice:" + language, value); } catch (e) {}
				window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "kokoroVoice", value } }));
			}, children: voices.map((name) => (0, react_jsx_runtime.jsx)("option", { value: name, children: name }, name)) })] })] });
		}
		function MascotDailyQuests() {
			const [tick, setTick] = mascotReact.useState(0);
			mascotReact.useEffect(() => {
				const refresh = () => setTick((v) => v + 1);
				window.addEventListener("whale-moe-prefs-change", refresh);
				window.addEventListener("storage", refresh);
				return () => { window.removeEventListener("whale-moe-prefs-change", refresh); window.removeEventListener("storage", refresh); };
			}, []);
			const pool = (window.DshWhaleMoeCore && window.DshWhaleMoeCore.QUEST_POOL) || [];
			const defOf = (id) => pool.find((q) => q.id === id) || { id, desc: id, target: 1, reward: { affinity: 0, mood: 0 } };
			let quests = null;
			try { const raw = window.localStorage.getItem("whale-moe:quests"); quests = raw ? JSON.parse(raw) : null; } catch (e) { quests = null; }
			const today = (() => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); })();
			const slots = quests && quests.date === today && Array.isArray(quests.slots) ? quests.slots : [];
			const claim = (id) => {
				try { if (window.__dshWhaleMoeClaimQuest) window.__dshWhaleMoeClaimQuest(id); } catch (e) {}
				setTick((v) => v + 1);
			};
			if (!slots.length) return (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 0" }, children: "Loading today's quests, refreshing shortly" });
			return (0, react_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", padding: "2px 0 4px", width: "100%" }, children: slots.map((slot, index) => {
				const def = defOf(slot.id);
				const done = slot.progress >= def.target;
				const last = index === slots.length - 1;
				return (0, react_jsx_runtime.jsxs)("div", { style: { alignItems: "center", borderBottom: last ? "none" : "1px solid var(--dsw-alias-border-l2)", display: "flex", gap: "10px", minHeight: "44px" }, children: [
					(0, react_jsx_runtime.jsx)("span", { style: { flex: 1, fontSize: "13px", lineHeight: "18px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: def.desc }),
					(0, react_jsx_runtime.jsxs)("div", { style: { alignItems: "center", display: "flex", gap: "6px", width: "104px" }, children: [
						(0, react_jsx_runtime.jsx)("div", { style: { background: "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "4px", flex: 1, height: "7px", overflow: "hidden" }, children: (0, react_jsx_runtime.jsx)("div", { style: { background: done ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-label-secondary, #888)", borderRadius: "4px", height: "100%", transition: "width 160ms ease", width: Math.min(100, Math.round(slot.progress / def.target * 100)) + "%" } }) }),
						(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "14px", whiteSpace: "nowrap" }, children: String(Math.min(slot.progress, def.target)) + "/" + String(def.target) })
					] }),
					slot.claimed
						? (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", textAlign: "right", width: "58px" }, children: "✅ Claimed" })
						: (0, react_jsx_runtime.jsx)("button", { type: "button", disabled: !done, onClick: () => claim(slot.id), style: { background: done ? "var(--dsw-static-accent, #4da3ff)" : "transparent", border: "1px solid var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "8px", color: done ? "#fff" : "var(--dsw-alias-label-secondary)", cursor: done ? "pointer" : "default", fontSize: "12px", height: "26px", padding: "0 10px", width: "58px" }, children: "Claim" })
				] });
			}) });
		}
		function MascotWeekSignin() {
			const [tick, setTick] = mascotReact.useState(0);
			mascotReact.useEffect(() => {
				const refresh = () => setTick((v) => v + 1);
				window.addEventListener("whale-moe-prefs-change", refresh);
				return () => window.removeEventListener("whale-moe-prefs-change", refresh);
			}, []);
			let week = null;
			try { const raw = window.localStorage.getItem("whale-moe:weekSignin"); week = raw ? JSON.parse(raw) : null; } catch (e) { week = null; }
			const days = week && Array.isArray(week.days) ? week.days.length : 0;
			const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
			return (0, react_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0 10px", width: "100%" }, children: [
				(0, react_jsx_runtime.jsx)("div", { style: { display: "flex", gap: "4px" }, children: Array.from({ length: 7 }, (_, i) => (0, react_jsx_runtime.jsxs)("div", { style: { alignItems: "center", display: "flex", flex: 1, flexDirection: "column", gap: "4px" }, children: [
					(0, react_jsx_runtime.jsx)("span", { style: { alignItems: "center", background: i < days ? "var(--dsw-static-accent, #4da3ff)" : "var(--dsw-alias-border-l3, #c9cdd6)", borderRadius: "50%", color: i < days ? "#fff" : "transparent", display: "flex", fontSize: "12px", height: "26px", justifyContent: "center", width: "26px" }, children: "✓" }),
					(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "14px" }, children: labels[i] })
				] })) }),
				(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "16px" }, children: "Checked in this week: " + days + " / 7 days · milestones at 1/3/7 days" })
			] });
		}
		function MascotBadgeRow() {
			const [tick, setTick] = mascotReact.useState(0);
			mascotReact.useEffect(() => {
				const refresh = () => setTick((v) => v + 1);
				window.addEventListener("whale-moe-prefs-change", refresh);
				return () => window.removeEventListener("whale-moe-prefs-change", refresh);
			}, []);
			const level = Number(MascotValue("level", "1")) || 1;
			const badges = (window.DshWhaleMoeCore && window.DshWhaleMoeCore.BOND && window.DshWhaleMoeCore.BOND.badges) || [];
			const unlocked = badges.filter((b) => level >= b.minLevel);
			const current = MascotValue("badge", "");
			if (!unlocked.length) return (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 0" }, children: "Locked (reach affection Lv5 to unlock the first title)" });
			return (0, react_jsx_runtime.jsxs)("label", { style: { ...MASCOT_ROW_STYLE, borderBottom: "none" }, children: [(0, react_jsx_runtime.jsx)("span", { children: "Title" }), (0, react_jsx_runtime.jsx)("select", {
				value: current,
				onChange: (event) => { const value = event.target.value; try { if (window.__dshWhaleMoeApplyBadge) window.__dshWhaleMoeApplyBadge(value); else window.localStorage.setItem("whale-moe:badge", value); } catch (e) {} setTick((v) => v + 1); },
				children: [(0, react_jsx_runtime.jsx)("option", { value: "", children: "(no title)" })].concat(unlocked.map((b) => (0, react_jsx_runtime.jsx)("option", { value: b.id, children: b.name })))
			})] });
		}
		function MascotAccordion({ title, icon, summary, defaultOpen, children }) {
			const [open, setOpen] = mascotReact.useState(!!defaultOpen);
			const left = (0, react_jsx_runtime.jsxs)("span", { style: { alignItems: "center", display: "flex", gap: "8px", minWidth: 0 }, children: [
				(0, react_jsx_runtime.jsx)("span", { style: { fontSize: "14px" }, children: icon || "" }),
				(0, react_jsx_runtime.jsxs)("span", { style: { alignItems: "flex-start", display: "flex", flexDirection: "column", minWidth: 0 }, children: [
					(0, react_jsx_runtime.jsx)("span", { style: { fontSize: "13px", fontWeight: "600" }, children: title }),
					summary ? (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", fontWeight: "400" }, children: summary }) : null
				] })
			] });
			const right = (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px" }, children: open ? "▾" : "▸" });
			return (0, react_jsx_runtime.jsxs)("div", { style: { background: "var(--dsw-alias-bg-module-platform, transparent)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", marginTop: "10px", overflow: "hidden", width: "100%" }, children: [
				(0, react_jsx_runtime.jsxs)("button", { type: "button", onClick: () => setOpen(!open), style: { alignItems: "center", background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "10px 14px", width: "100%" }, children: [left, right] }),
				open ? (0, react_jsx_runtime.jsx)("div", { style: { padding: "0 14px 8px" }, children }) : null
			] });
		}
		function MascotTabs({ active, onChange, tabs }) {
			const list = tabs || [{ id: "quests", label: "Today's quests" }, { id: "week", label: "This week's check-ins" }];
			return (0, react_jsx_runtime.jsx)("div", { style: { background: "var(--dsw-alias-interactive-bg-hover, transparent)", borderRadius: "10px", display: "flex", gap: "4px", marginBottom: "8px", padding: "3px" }, children: list.map((t) => (0, react_jsx_runtime.jsx)("button", { key: t.id, type: "button", onClick: () => onChange(t.id), style: { background: active === t.id ? "var(--dsw-static-accent, #4da3ff)" : "transparent", border: "none", borderRadius: "8px", color: active === t.id ? "#fff" : "inherit", cursor: "pointer", flex: 1, fontSize: "13px", padding: "6px 0" }, children: t.label })) });
		}
		function MascotDailyCard() {
			const [tab, setTab] = mascotReact.useState("quests");
			return (0, react_jsx_runtime.jsxs)(MascotAccordion, { title: "Daily and progression", icon: "🎯", summary: "Quests, check-ins and titles", defaultOpen: false, children: [
				(0, react_jsx_runtime.jsx)(MascotTabs, { active: tab, onChange: setTab, tabs: [{ id: "quests", label: "Today's quests" }, { id: "week", label: "This week's check-ins" }, { id: "badge", label: "Title" }] }),
				tab === "quests" ? (0, react_jsx_runtime.jsx)(MascotDailyQuests, {}) : (tab === "week" ? (0, react_jsx_runtime.jsx)(MascotWeekSignin, {}) : (0, react_jsx_runtime.jsx)(MascotBadgeRow, {}))
			] });
		}
		function MascotAchievementRow() {
			const ids = MascotValue("achievements", "").split(",").filter(Boolean);
			return (0, react_jsx_runtime.jsx)(MascotAchievementWall, { ids });
		}
		function MascotResetRow() {
			return (0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "Floating position" }), (0, react_jsx_runtime.jsx)("button", { type: "button", onClick: () => { try { window.localStorage.removeItem("whale-moe:floatX"); window.localStorage.removeItem("whale-moe:floatY"); } catch (e) {} window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "float-reset", value: true } })); }, children: "Reset to default position" })] });
		}
		function MascotGrowthResetRow() {
			return (0, react_jsx_runtime.jsxs)("label", { style: MASCOT_ROW_STYLE, children: [(0, react_jsx_runtime.jsx)("span", { children: "Progression data" }), (0, react_jsx_runtime.jsx)("button", { type: "button", onClick: () => { ["mood", "affinity", "satiety", "lastSignin", "signinStreak", "achievements", "companionSince", "level", "quests", "weekSignin", "badge", "gameStats"].forEach((k) => { try { window.localStorage.removeItem("whale-moe:" + k); } catch (e) {} }); window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth-reset", value: true } })); }, children: "Reset progression" })] });
		}
		function MascotPrefRows() {
			return (0, react_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: [
				(0, react_jsx_runtime.jsx)(MascotOverviewCard, {}),
				(0, react_jsx_runtime.jsxs)(MascotAccordion, { title: "Companion behaviour", icon: "🎛️", summary: "How Umika appears and talks", defaultOpen: true, children: [(0, react_jsx_runtime.jsx)(MascotSwitchGrid, {}), (0, react_jsx_runtime.jsx)(MascotLanguageRow, {})] }),
				(0, react_jsx_runtime.jsx)(MascotAccordion, { title: "Weather", icon: "⛅", summary: "City and weather effects", defaultOpen: false, children: [(0, react_jsx_runtime.jsx)(MascotWeatherRow, {}), (0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: "11px", lineHeight: "15px", padding: "0 0 6px" }, children: "Effects only show once a city is set and the weather data is fresh; they ease off while you are working and thunder flashes stop." })] }),
				(0, react_jsx_runtime.jsx)(MascotDailyCard, {}),
				(0, react_jsx_runtime.jsx)(MascotAccordion, { title: "Achievement wall", icon: "🏅", summary: "Unlocked " + MascotValue("achievements", "").split(",").filter(Boolean).length + " / " + MASCOT_ACHIEVEMENTS.length, defaultOpen: false, children: [(0, react_jsx_runtime.jsx)(MascotAchievementRow, {})] }),
				(0, react_jsx_runtime.jsx)(MascotAccordion, { title: "Data and reset", icon: "🗂️", summary: "Position and progression data", defaultOpen: false, children: [(0, react_jsx_runtime.jsx)(MascotResetRow, {}), (0, react_jsx_runtime.jsx)(MascotGrowthResetRow, {})] })
			]});
		}
		function MascotSection({ renderSlot }) {
			return (0, react_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", width: "100%" }, children: renderSlot("settings.mascot.item", {}) });
		}
		ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "mascot", order: 6, label: "Mascot", children: { "settings.mascot.item": { kind: "list", scope: "root" } } }, MascotSection));
		ctx.slots.inject("settings.mascot.item", () => ctx.slots.register({ name: "settings.mascot.item", id: "mascot-prefs", order: 0, store, locale: MASCOT_NS, inject: injected }, MascotPrefRows));`;
}

export function patchMascotClient(source) {
  if (source.includes(MASCOT_SETTINGS_MARKER)) return { source, changed: false };
  const anchorMissing = () => {
    /* Newer DSH builds dropped the theme-pack settings slot this mode patches
       (dsh-client-ui-theme registers settings.general.item only). Rebuilding the
       panel against a different, build-specific anchor would risk a syntax error
       inside someone's settings bundle, so refuse loudly and point at the paths
       that do work on any build. */
    if (source.includes(MASCOT_SETTINGS_ANCHOR)) return;
    throw new Error(
      "--mascot-settings cannot patch this DSH build: it has no theme-pack settings slot " +
        `(anchor ${JSON.stringify(MASCOT_SETTINGS_ANCHOR)} not found in ${REL.themeClient}).\n` +
        "  Umika herself, including the Japanese voice, works from --target alone;\n" +
        "  every toggle (mascot / bubbles / Japanese voice / particles) is in her gear menu.\n" +
        "  For a section on the DSH settings page, install the plugin as a bundle instead:\n" +
        "  its lib/client.js registers settings.section (id=mascot) natively, on any build."
    );
  };
  const legacyMarker = MASCOT_SETTINGS_LEGACY.find((marker) => source.includes(`/* ${marker} */`));
  if (legacyMarker) {
    anchorMissing();
    const start = source.indexOf(`/* ${legacyMarker} */`);
    const tail = "}, MascotPrefRows));";
    const end = source.indexOf(tail, start);
    if (start === -1 || end === -1) throw new Error("legacy mascot settings block not found for upgrade");
    const withoutLegacy = source.slice(0, start) + source.slice(end + tail.length);
    return { source: replaceExactlyOnce(withoutLegacy, MASCOT_SETTINGS_ANCHOR, mascotBlock(MASCOT_SETTINGS_MARKER), "mascot settings slot upgrade"), changed: true };
  }
  anchorMissing();
  return { source: replaceExactlyOnce(source, MASCOT_SETTINGS_ANCHOR, mascotBlock(MASCOT_SETTINGS_MARKER), "mascot settings slot"), changed: true };
}

export function planMascotWrites(target) {
  const base = path.resolve(target);
  return {
    target: base,
    writes: [
      { rel: REL.themeClient, content: patchMascotClient(read(path.join(base, ...REL.themeClient.split("/")))).source }
    ]
  };
}

export function mascotSettings(target = DEFAULT_TARGET, options = {}) {
  const { target: base, writes } = planMascotWrites(target);
  const backupRoot = typeof options.backupRoot === "string" && options.backupRoot.length > 0 ? options.backupRoot : BACKUP_ROOT;
  const records = writes.map((item, index) => {
    const dest = path.join(base, ...item.rel.split("/"));
    const originalExists = fs.existsSync(dest);
    const original = originalExists ? fs.readFileSync(dest) : null;
    return {
      ...item, dest, index,
      backupName: originalExists ? `file-${String(index).padStart(2, "0")}-${path.basename(dest)}` : null,
      originalExists,
      originalSha256: original === null ? null : sha256(original),
      patchedSha256: sha256(item.content),
      original
    };
  });
  if (records.every((record) => record.originalExists && record.originalSha256 === record.patchedSha256)) {
    console.log(`[dsh-whale-moe] ${MASCOT_SETTINGS_MARKER} is already applied.`);
    return "already";
  }
  const backupDir = path.join(backupRoot, `dsh-whale-moe-mascot-settings-${timestamp()}`);
  fs.mkdirSync(backupDir, { recursive: false });
  for (const record of records) {
    if (record.originalExists) {
      fs.mkdirSync(path.dirname(path.join(backupDir, record.backupName)), { recursive: true });
      fs.writeFileSync(path.join(backupDir, record.backupName), record.original);
    }
  }
  const manifest = {
    marker: MASCOT_SETTINGS_MARKER, target: base, createdAt: new Date().toISOString(),
    files: records.map(({ dest, backupName, originalExists, originalSha256, patchedSha256 }) => ({ dest, backupName, originalExists, originalSha256, patchedSha256 }))
  };
  fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  for (const record of records) {
    fs.mkdirSync(path.dirname(record.dest), { recursive: true });
    fs.writeFileSync(record.dest, record.content);
  }
  console.log(`[dsh-whale-moe] Installed mascot settings section (${base})`);
  console.log(`[dsh-whale-moe] Backup: ${backupDir}`);
  return backupDir;
}

export function rollback(backupDir) {
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`Backup manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (![MARKER, UNTHEME_MARKER, MASCOT_SETTINGS_MARKER, MASCOT_SETTINGS_LEGACY].includes(manifest.marker) || !Array.isArray(manifest.files)) throw new Error(`Unsupported backup manifest: ${manifestPath}`);
  for (const record of manifest.files) {
    if (record.originalExists) {
      const backup = fs.readFileSync(path.join(backupDir, record.backupName));
      if (sha256(backup) !== record.originalSha256) throw new Error(`Backup checksum mismatch: ${record.dest}`);
      fs.mkdirSync(path.dirname(record.dest), { recursive: true });
      fs.writeFileSync(record.dest, backup);
    } else if (fs.existsSync(record.dest)) {
      fs.unlinkSync(record.dest);
    }
  }
  console.log(`[dsh-whale-moe] Rolled back: ${backupDir}`);
  return backupDir;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const targetIdx = args.indexOf("--target");
  const rollbackIdx = args.indexOf("--rollback");
  const unthemeIdx = args.indexOf("--untheme");
  const assetsOnlyIdx = args.indexOf("--assets-only");
  const mascotSettingsIdx = args.indexOf("--mascot-settings");
  if (rollbackIdx >= 0) {
    const dir = args[rollbackIdx + 1];
    if (!dir) { console.error("usage: --rollback <backupDir>"); process.exit(2); }
    rollback(path.resolve(dir));
  } else if (unthemeIdx >= 0) {
    const target = targetIdx >= 0 ? args[targetIdx + 1] : DEFAULT_TARGET;
    if (!target) { console.error("usage: --untheme [--target <dir>]"); process.exit(2); }
    if (!fs.existsSync(target)) { console.error(`target not found: ${target}`); process.exit(2); }
    untheme(target);
  } else if (mascotSettingsIdx >= 0) {
    const target = targetIdx >= 0 ? args[targetIdx + 1] : DEFAULT_TARGET;
    if (!target) { console.error("usage: --mascot-settings [--target <dir>]"); process.exit(2); }
    if (!fs.existsSync(target)) { console.error(`target not found: ${target}`); process.exit(2); }
    mascotSettings(target);
  } else {
    const target = targetIdx >= 0 ? args[targetIdx + 1] : DEFAULT_TARGET;
    if (!target) { console.error("usage: [--target <dir>]"); process.exit(2); }
    if (!fs.existsSync(target)) { console.error(`target not found: ${target}`); process.exit(2); }
    apply(target, { assetsOnly: assetsOnlyIdx >= 0 });
  }
}
