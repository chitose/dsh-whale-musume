import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOCAL_PREVIEW = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".voice-preview");
const PYTHON_REL = process.platform === "win32" ? "Scripts/python.exe" : "bin/python";

export function voiceHome() {
  if (process.env.DSH_WHALE_VOICE_HOME) return path.resolve(process.env.DSH_WHALE_VOICE_HOME);
  if (existsSync(path.join(LOCAL_PREVIEW, "setup.json")) && existsSync(path.join(LOCAL_PREVIEW, ".venv", PYTHON_REL))) return LOCAL_PREVIEW;
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA || os.homedir(), "dsh-whale-musume", "voice");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "dsh-whale-musume", "voice");
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "dsh-whale-musume", "voice");
}

export function voicePython(home = voiceHome()) {
  if (process.env.DSH_WHALE_VOICE_PYTHON) return path.resolve(process.env.DSH_WHALE_VOICE_PYTHON);
  if (home === LOCAL_PREVIEW) return path.join(home, ".venv", PYTHON_REL);
  return path.join(home, "venv", PYTHON_REL);
}
