import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { voiceHome, voicePython } from "./voice-home.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "..", "assets");
const HOME = voiceHome();
const CACHE = path.join(HOME, "cache");
const MODEL = path.join(HOME, "models", "kokoro-v1.0.fp16.onnx");
const VOICES = path.join(HOME, "models", "voices-v1.0.bin");
const LIMIT = 4096;

function send(res, status, object) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(object));
}

async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > LIMIT) throw new Error("request too large");
  }
  return JSON.parse(text);
}

export function createVoiceService(logger) {
  let child = null;
  let port = 0;
  let starting = null;
  let error = "";
  const token = randomBytes(24).toString("hex");
  const installed = () => existsSync(path.join(HOME, "setup.json")) && existsSync(voicePython(HOME)) && existsSync(MODEL) && existsSync(VOICES);

  async function start() {
    if (port && child?.exitCode === null) return port;
    if (!installed()) throw new Error("Voice setup required: run npm run setup:voice");
    if (starting) return starting;
    starting = new Promise((resolve, reject) => {
      const process = spawn(voicePython(HOME), [path.join(HERE, "voice-sidecar.py"), "--home", HOME, "--assets", ASSETS, "--token", token], {
        cwd: HERE, env: { ...globalThis.process.env, ARGOS_PACKAGES_DIR: path.join(HOME, "argos-packages"), XDG_DATA_HOME: HOME, XDG_CONFIG_HOME: HOME, XDG_CACHE_HOME: HOME, PYTHONIOENCODING: "utf-8" },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      });
      child = process;
      let output = "";
      let stderrBytes = 0;
      let done = false;
      const timer = setTimeout(() => finish(new Error("voice sidecar start timed out")), 15000);
      const finish = (failure, readyPort) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (failure) {
          error = failure.message;
          process.kill();
          reject(failure);
        } else {
          error = "";
          port = readyPort;
          resolve(readyPort);
        }
      };
      process.stdout.on("data", (chunk) => {
        output += chunk.toString();
        const match = /^PORT (\d+)\s*$/m.exec(output);
        if (match) finish(null, Number(match[1]));
      });
      process.stderr.on("data", (chunk) => {
        if (stderrBytes >= 2000) return;
        const message = chunk.toString().replaceAll("\0", "").trim().slice(0, 500);
        stderrBytes += chunk.length;
        if (message) logger?.warn?.(`voice sidecar: ${message}`);
      });
      process.on("error", (failure) => finish(failure));
      process.on("exit", (code) => {
        port = 0;
        if (!done) finish(new Error(`voice sidecar exited (${code})`));
        child = null;
      });
    }).finally(() => { starting = null; });
    return starting;
  }

  async function handler(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const origin = req.headers.origin;
    if (origin) {
      let sameOrigin = false;
      try { sameOrigin = new URL(origin).host === req.headers.host; } catch { /* malformed Origin */ }
      if (!sameOrigin) { send(res, 403, { error: "forbidden" }); return; }
    }
    if (req.method === "GET" && url.pathname.endsWith("/status")) {
      send(res, 200, { installed: installed(), running: !!port, error, cacheBytes: existsSync(CACHE) ? readdirSync(CACHE).filter((name) => name.endsWith(".wav")).reduce((n, name) => n + statSync(path.join(CACHE, name)).size, 0) : 0 });
      return;
    }
    if (req.method === "POST" && url.pathname.endsWith("/clear")) {
      if (existsSync(CACHE)) for (const file of readdirSync(CACHE)) if (/^[a-f0-9]{64}\.wav$/.test(file)) rmSync(path.join(CACHE, file));
      send(res, 200, { cleared: true });
      return;
    }
    if (req.method === "GET" && url.pathname.endsWith("/file")) {
      const id = url.searchParams.get("id") || "";
      if (!/^[a-f0-9]{64}$/.test(id)) { send(res, 400, { error: "invalid file" }); return; }
      const file = path.join(CACHE, id + ".wav");
      if (!existsSync(file)) { send(res, 404, { error: "not found" }); return; }
      res.writeHead(200, { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" });
      createReadStream(file).pipe(res);
      return;
    }
    if (req.method !== "POST" || !url.pathname.endsWith("/synthesize")) { send(res, 404, { error: "not found" }); return; }
    try {
      const payload = await body(req);
      const sidecarPort = await start();
      const response = await fetch(`http://127.0.0.1:${sidecarPort}/synthesize`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Voice-Token": token }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "synthesis failed");
      send(res, 200, { text: result.text, audio: result.file ? "/api/dsh-whale-musume/voice/file?id=" + result.file : null });
    } catch (failure) {
      error = failure.message;
      send(res, 503, { error });
    }
  }

  return { handler, close: () => { child?.kill(); child = null; port = 0; } };
}
