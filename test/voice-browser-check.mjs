/* voice-browser-check.mjs — end-to-end check of the bundled Japanese voice.
 *
 * Serves this repository over http (so the presenter's default asset roots
 * resolve exactly as a theme install resolves them), loads whale-moe-core plus
 * the presenter in headless Chrome, drives a real state change, and asserts:
 *
 *   1. the presenter fetched a voice manifest,
 *   2. it asked the browser to play a clip from the voice directory,
 *   3. the clip URL exists on disk and matches a core line,
 *   4. playback actually progressed (which proves Chromium decoded the Ogg),
 *   5. turning the voice toggle off silences the very next line.
 *
 * Manual check, not part of `npm test`: it needs Chrome and a free port.
 *   node test/voice-browser-check.mjs                 # headless, silent, asserts
 *   node test/voice-browser-check.mjs --headed        # watch it on screen, audible
 *   node test/voice-browser-check.mjs --chrome <path> --port 3199
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCore } from "./load-core.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(arg("--port", "3199"));
const CDP_PORT = PORT + 1;
const HEADED = args.includes("--headed");
/* DSH's static asset server does not map .ogg, so a theme-mode install serves
   clips as application/octet-stream. Reproduce that to prove playback survives it. */
const OCTET_STREAM = args.includes("--octet-stream");

const CANDIDATES = [
  arg("--chrome", ""),
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
];
const CHROME = CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate));
if (!CHROME) {
  console.error("voice-browser-check: no Chrome/Edge found; pass --chrome <path>");
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".png": "image/png"
};

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>voice check</title>
<style>
  html, body { margin: 0; height: 100%; }
  [data-slot="conversation.chat.node"] { position: fixed; left: 20px; top: 20px; width: 640px; height: 420px; }
</style>
</head>
<body>
  <div data-slot="conversation.chat.node"></div>
  <script>
    window.__whale = { audio: [], fetches: [], rejections: [], progress: [] };
    var OriginalAudio = window.Audio;
    window.Audio = function () {
      var el = new OriginalAudio();
      var play = el.play.bind(el);
      el.play = function () {
        var record = { src: el.src, started: false, seconds: 0 };
        window.__whale.audio.push(record);
        var result = play();
        if (result && typeof result.then === "function") {
          result.then(function () {
            record.started = true;
            setTimeout(function () {
              record.seconds = el.currentTime;
              window.__whale.progress.push({ src: el.src, seconds: el.currentTime });
            }, 700);
          }).catch(function (error) { window.__whale.rejections.push(String(error)); });
        }
        return result;
      };
      return el;
    };
    var originalFetch = window.fetch.bind(window);
    window.fetch = function (input) {
      try { window.__whale.fetches.push(String(input)); } catch (e) { /* ignore */ }
      return originalFetch.apply(window, arguments);
    };
  </script>
  <script src="/assets/whale-moe-core.js"></script>
  <script src="/assets/dsh-whale-moe.js"></script>
</body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/" || url.pathname === "/voice-check.html") {
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(PAGE);
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }
  const extension = path.extname(file).toLowerCase();
  const type = OCTET_STREAM && extension === ".ogg"
    ? "application/octet-stream"
    : MIME[extension] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(file).pipe(res);
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    }
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  return { call, close: () => ws.close() };
}

const evaluate = async (call, expression) => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluate failed");
  return result.result.value;
};

async function waitFor(call, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(call, expression)) return true;
    await delay(150);
  }
  failures.push(`timeout waiting for ${label}`);
  return false;
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "whale-voice-check-"));
let chrome;
let session;
try {
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const pageUrl = `http://127.0.0.1:${PORT}/voice-check.html`;
  console.log(`serving ${ROOT}\n  page ${pageUrl}\n  chrome ${CHROME}`);
  if (OCTET_STREAM) console.log("  serving .ogg as application/octet-stream (theme-mode static server)");

  chrome = spawn(
    CHROME,
    [
      HEADED ? "--new-window" : "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-gpu",
      /* --mute-audio keeps the automated run polite; the headed run is for ears */
      ...(HEADED ? [] : ["--mute-audio"]),
      /* the whole point is to exercise playback without a user gesture */
      "--autoplay-policy=no-user-gesture-required",
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  let version = null;
  for (let attempt = 0; attempt < 60 && !version; attempt += 1) {
    await delay(250);
    try {
      version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
    } catch { /* not up yet */ }
  }
  if (!version) throw new Error("Chrome did not expose a CDP endpoint");
  console.log(`  browser ${version.Browser}`);

  const target = await (
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })
  ).json();
  session = await connect(target.webSocketDebuggerUrl);
  await session.call("Page.enable");
  await session.call("Runtime.enable");
  await session.call("Page.navigate", { url: pageUrl });

  const booted = await waitFor(session.call, "!!document.querySelector('[data-dsh-whale-root]')", 15000, "the mascot root");
  check(booted, "the presenter boots and mounts the mascot");

  /* the first bubble is a core idle line, so a clip should already be requested */
  const manifestFetched = await waitFor(
    session.call,
    "__whale.fetches.some(function (u) { return u.indexOf('voice/ja/manifest.json') !== -1; })",
    10000,
    "the voice manifest fetch"
  );
  check(manifestFetched, "the presenter fetches the voice manifest");

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "voice", "ja", "manifest.json"), "utf8"));
  const played = await waitFor(session.call, "__whale.audio.length > 0", 10000, "the first clip");
  check(played, "a clip is requested for the first bubble line");

  const first = await evaluate(session.call, "__whale.audio[0] || null");
  if (first) {
    const file = first.src.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    check(file.startsWith("/assets/voice/ja/"), "the clip comes from the voice directory", file);
    const key = Object.keys(manifest.files).find((line) => manifest.files[line] === file.replace("/assets/voice/ja/", ""));
    check(Boolean(key), "the requested clip maps back to a core line", key ? JSON.stringify(key) : file);
    check(fs.existsSync(path.join(ROOT, file)), "the clip exists on disk");
  } else {
    failures.push("no audio record to inspect");
  }

  /* Phase 2: a real state transition must speak. The state machine has a 6s
     speech gap (core.SPEECH_GAP_MS), so give it room before giving up. */
  const chatter = `document.querySelector('[data-slot="conversation.chat.node"]')`;
  await evaluate(
    session.call,
    `${chatter}.insertAdjacentHTML('beforeend', '<div data-state="error" id="wf" style="width:320px;height:120px"></div>')`
  );
  const spokeAgain = await waitFor(session.call, "__whale.audio.length > 1", 20000, "a spoken line after transitioning to failure");
  check(spokeAgain, "a state change speaks another line");

  /* Regression guard: the reconcile loop writes state lines (LINES banks) to the
     bubble directly, and that path used to be completely silent. */
  const stateLines = new Set(Object.values(loadCore().LINES).flat());
  const requested = await evaluate(
    session.call,
    "__whale.audio.map(function (a) { return a.src.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0]; })"
  );
  const requestedKeys = (requested || []).map((url) => {
    const file = url.replace("/assets/voice/ja/", "");
    return Object.keys(manifest.files).find((line) => manifest.files[line] === file);
  });
  check(
    requestedKeys.some((key) => key && stateLines.has(key)),
    "a state-bank line is voiced (the path that was silent)",
    requestedKeys.filter(Boolean).join(" | ").slice(0, 120)
  );

  /* Phase 3: positive control for the negative test below — the same kind of
     transition really does speak while the toggle is on. */
  await evaluate(session.call, "window.__whale.audio.length = 0; document.getElementById('wf').remove();");
  await delay(7000);
  await evaluate(
    session.call,
    `${chatter}.insertAdjacentHTML('beforeend', '<div data-state="success" id="ws" style="width:320px;height:120px"></div>')`
  );
  const control = await waitFor(session.call, "__whale.audio.length > 0", 20000, "the success line with the voice on");
  check(control, "control: the same transition speaks while the voice is on");

  /* decoding proof: the ogg really played, not just resolved */
  await delay(1200);
  const progress = await evaluate(session.call, "__whale.progress.filter(function (p) { return p.seconds > 0; }).length");
  check(progress > 0, "Chromium decoded and advanced playback", `${progress} clip(s) with currentTime > 0`);

  const rejections = await evaluate(session.call, "__whale.rejections");
  check(Array.isArray(rejections) && rejections.length === 0, "no playback rejections", JSON.stringify(rejections));

  /* Phase 4: with the toggle off the same transition must stay silent. */
  await evaluate(
    session.call,
    "localStorage.setItem('whale-moe:voiceJa', '0'); window.__whale.audio.length = 0; document.getElementById('ws').remove();"
  );
  await delay(7000);
  await evaluate(
    session.call,
    `${chatter}.insertAdjacentHTML('beforeend', '<div data-state="error" id="wo" style="width:320px;height:120px"></div>')`
  );
  await delay(9000);
  const afterOff = await evaluate(session.call, "__whale.audio.length");
  check(afterOff === 0, "the 'Japanese voice' toggle silences the next line", `${afterOff} clip(s) after switching off`);
} catch (error) {
  failures.push(`harness error: ${error.message}`);
  console.error(`  FAIL harness error: ${error.stack || error.message}`);
} finally {
  try { session?.close(); } catch { /* ignore */ }
  try { chrome?.kill(); } catch { /* ignore */ }
  await delay(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  server.close();
}

console.log(failures.length ? `\nvoice-browser-check: ${failures.length} failure(s)\n  - ${failures.join("\n  - ")}` : "\nvoice-browser-check: all checks passed");
process.exit(failures.length ? 1 : 0);
