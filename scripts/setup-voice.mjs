#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, statSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { voiceHome, voicePython } from "../lib/voice-home.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = voiceHome();
const python = voicePython(home);
const models = path.join(home, "models");
const base = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1";

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env, windowsHide: true });
  if (result.error?.code === "ENOENT") throw new Error(`${command} was not found; install uv or Python 3.12 and retry`);
  if (result.error || result.status !== 0) throw result.error || new Error(`${command} exited ${result.status}`);
}

async function download(name, minimum) {
  const target = path.join(models, name);
  if (existsSync(target) && statSync(target).size >= minimum) return;
  const temp = target + ".download";
  console.log(`Downloading ${name}…`);
  const response = await fetch(`${base}/${name}`);
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  try {
    const stream = Readable.fromWeb(response.body);
    let received = 0;
    let nextReport = 20e6;
    stream.on("data", (chunk) => {
      received += chunk.length;
      if (received >= nextReport) {
        console.log(`  ${Math.round(received / 1e6)} MB downloaded`);
        nextReport += 20e6;
      }
    });
    await pipeline(stream, createWriteStream(temp));
    if (statSync(temp).size < minimum) throw new Error(`${name} download is incomplete`);
    renameSync(temp, target);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

mkdirSync(home, { recursive: true });
mkdirSync(models, { recursive: true });
console.log(`Voice data: ${home}`);
if (!existsSync(python)) {
  const uv = spawnSync("uv", ["--version"], { stdio: "ignore", windowsHide: true });
  if (uv.status === 0) run("uv", ["venv", path.join(home, "venv"), "--python", "3.12"]);
  else if (process.platform === "win32") run("py", ["-3.12", "-m", "venv", path.join(home, "venv")]);
  else run("python3.12", ["-m", "venv", path.join(home, "venv")]);
}
const requirements = ["kokoro-onnx==0.6.1", "misaki-fork==0.9.6", "pyopenjtalk-plus==0.4.1.post9", "soundfile", "argostranslate"];
const uv = spawnSync("uv", ["--version"], { stdio: "ignore", windowsHide: true });
if (uv.status === 0) run("uv", ["pip", "install", "--python", python, ...requirements]);
else run(python, ["-m", "pip", "install", ...requirements]);
await download("kokoro-v1.0.fp16.onnx", 100e6);
await download("voices-v1.0.bin", 20e6);
run(python, [path.join(root, "lib", "install-translation.py")], {
  ...process.env,
  ARGOS_PACKAGES_DIR: path.join(home, "argos-packages"),
  XDG_DATA_HOME: home,
  XDG_CONFIG_HOME: home,
  XDG_CACHE_HOME: home,
  PYTHONIOENCODING: "utf-8",
});
writeFileSync(path.join(home, "setup.json"), JSON.stringify({ version: 1, model: "kokoro-v1.0.fp16", translation: "en-ja" }));
console.log("Voice setup complete. Restart DSH Web to use the Kokoro sidecar.");
