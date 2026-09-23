"""Local Kokoro and Argos worker. The Cordis host alone can reach this port."""

import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading
import time
import traceback

MAX_CACHE_BYTES = 500 * 1024 * 1024
MODEL_VERSION = "kokoro-v1.0.fp16+argos-en-ja-v1"
VOICES = {"en": ("af_sarah", "en-us"), "ja": ("jf_tebukuro", "ja")}
lock = threading.Lock()
kokoro = None
g2p = None
translations = None
cache_dir = None
model_dir = None
access_token = None


def prepare(args):
    global translations, cache_dir, model_dir
    home = Path(args.home)
    cache_dir = home / "cache"
    model_dir = home / "models"
    cache_dir.mkdir(parents=True, exist_ok=True)
    translations = json.loads((Path(args.assets) / "voice" / "ja" / "translations.json").read_text(encoding="utf-8"))
    os.environ["ARGOS_PACKAGES_DIR"] = str(home / "argos-packages")


def localized(source, language, title, self_name):
    if language == "en":
        return source.replace("Master", title).replace("Umika", self_name)
    if source in translations:
        text = translations[source]
    else:
        import argostranslate.translate
        parts = re.split(r"\b(Master|Umika)\b", source)
        text = "".join(title if part == "Master" else self_name if part == "Umika" else
                       argostranslate.translate.translate(part, "en", "ja") if part.strip() else part
                       for part in parts)
    return text.replace("マスター", title).replace("くじらちゃん", self_name)


def prune_cache():
    files = sorted(cache_dir.glob("*.wav"), key=lambda file: file.stat().st_mtime)
    total = sum(file.stat().st_size for file in files)
    for file in files:
        if total <= MAX_CACHE_BYTES:
            break
        size = file.stat().st_size
        file.unlink(missing_ok=True)
        total -= size


def synthesize(payload):
    global kokoro, g2p
    source = payload.get("line", "")
    language = payload.get("language", "ja")
    title = payload.get("title", "Master")
    self_name = payload.get("selfName", "Umika")
    if not isinstance(source, str) or not source.strip() or len(source) > 1000 or language not in VOICES:
        raise ValueError("invalid line or language")
    if not all(isinstance(value, str) and len(value) <= 64 for value in (title, self_name)):
        raise ValueError("invalid name")
    text = localized(source.strip(), language, title, self_name)
    if payload.get("speak") is False:
        return {"text": text, "file": None}
    voice, lang = VOICES[language]
    key = hashlib.sha256(json.dumps([text, language, voice, MODEL_VERSION], ensure_ascii=False).encode()).hexdigest()
    target = cache_dir / (key + ".wav")
    with lock:
        if not target.exists():
            if kokoro is None:
                import onnxruntime
                onnxruntime.set_default_logger_severity(3)
                from kokoro_onnx import Kokoro
                kokoro = Kokoro(str(model_dir / "kokoro-v1.0.fp16.onnx"), str(model_dir / "voices-v1.0.bin"))
            if language == "ja":
                from misaki import ja
                if g2p is None:
                    g2p = ja.JAG2P(version="pyopenjtalk")
                # The Japanese model is fed phonemes, as in the existing offline renderer.
                from kokoro_render_phonemes import phonemize_japanese
                samples, rate = kokoro.create(phonemize_japanese(text, g2p), voice=voice, speed=1.0, is_phonemes=True)
            else:
                samples, rate = kokoro.create(text, voice=voice, speed=1.0, lang=lang)
            import soundfile as sf
            temporary = target.with_suffix(".tmp")
            sf.write(str(temporary), samples, rate, format="WAV", subtype="PCM_16")
            temporary.replace(target)
            prune_cache()
        else:
            os.utime(target, None)
    return {"text": text, "file": key}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.headers.get("X-Voice-Token") != access_token:
            self.send_error(403)
            return
        if self.path != "/synthesize" or int(self.headers.get("Content-Length", "0")) > 4096:
            self.send_error(400)
            return
        try:
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            result = synthesize(payload)
            body = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(200)
        except ValueError as error:
            body = json.dumps({"error": str(error)}).encode()
            self.send_response(400)
        except Exception as error:
            traceback.print_exc()
            body = json.dumps({"error": str(error)}).encode()
            self.send_response(503)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--home", required=True)
    parser.add_argument("--assets", required=True)
    parser.add_argument("--token", required=True)
    args = parser.parse_args()
    access_token = args.token
    prepare(args)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    print(f"PORT {server.server_port}", flush=True)
    server.serve_forever()
