#!/usr/bin/env python
"""Umika JP voice pilot — step 2 of 2.

Renders every line in .voice-preview/pilot.json with every requested Japanese
voice using kokoro-onnx, and reports what the model actually saw.

Two phoneme variants are produced per line so the audio can decide between them:

  raw    — misaki's JAG2P output verbatim, the way the kokoro-onnx
           examples/japanese.py feeds it (`is_phonemes=True`). It carries
           misaki's pitch markers (_ ^ - j), and kokoro's tokenizer silently
           drops every character missing from the model vocabulary.
  clean  — the same G2P result rebuilt from its per-word tokens, so the pitch
           markers are gone, then the handful of ambiguous consonants are
           normalised onto the model's IPA vocabulary (g -> ɡ, and misaki's
           precomposed clusters such as ᶄ -> ky).

The script never lets a silent degradation pass unreported: for each render it
prints how many phonemes the vocabulary rejected and which characters they were.

Usage:
  .voice-preview/.venv/Scripts/python.exe scripts/kokoro-render.py \
      [--job .voice-preview/pilot.json] [--voices jf_alpha,...] [--speed 1.0]
"""

import argparse
import json
import os
import sys
import wave

import numpy as np

SAMPLE_RATE = 24000
MIN_SECONDS = 0.4
MAX_SECONDS = 15.0
MIN_PEAK = 0.02

# misaki's ja G2P emits ASCII / precomposed consonants for a few rare clusters.
# The vocabulary carries the decomposed forms instead, so map them across.
CONSONANT_FIX = [
    ("\u1d84", "ky"),  # ᶄ
    ("\u1d83", "gy"),  # ᶃ
    ("\u1d80", "by"),  # ᶀ
    ("\u1d81", "dy"),  # ᶁ
    ("\u1d86", "my"),  # ᶆ
    ("\u1d88", "py"),  # ᶈ
    ("\u1d89", "ry"),  # ᶉ
    ("\u01ab", "ty"),  # ƫ
    ("K", "kw"),
    ("G", "gw"),
    ("g", "\u0261"),  # g -> ɡ, the only voicing mismatch that is common
]


def phonemize(text, g2p):
    """G2P with a kana-reading fallback.

    pyopenjtalk reports some readings with a truncated pronunciation but an
    unchanged mora size (間 -> pron マ, mora_size 3), which trips misaki's own
    consistency assert and would otherwise abort the whole run. Re-running the
    G2P on the kana reading side-steps it with the same phonemes.
    """
    try:
        return g2p(text), "direct", ""
    except AssertionError as error:
        import pyopenjtalk

        kana = pyopenjtalk.g2p(text, kana=True)
        if not kana or kana == text:
            raise
        return g2p(kana), "kana-fallback", str(error)


def rebuild_phonemes(tokens):
    """Pitch-free phonemes, rebuilt from the per-word G2P tokens."""
    out = []
    for token in tokens or []:
        out.append(token.phonemes or "")
        out.append(token.whitespace or "")
    return "".join(out)


def normalize(phonemes):
    for old, new in CONSONANT_FIX:
        phonemes = phonemes.replace(old, new)
    return phonemes


def unknown_chars(phonemes, vocab):
    seen = {}
    for char in phonemes:
        if char not in vocab:
            seen[char] = seen.get(char, 0) + 1
    return seen


def write_wav(path, samples, rate):
    clipped = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    data = (clipped * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(data.tobytes())


def write_index(preview, job, manifest):
    """One page with every rendered take side by side, so a voice can be picked by ear."""
    import html

    by_key = {(e["n"], e["variant"], e["voice"]): e for e in manifest["entries"]}
    voices = sorted({e["voice"] for e in manifest["entries"]})
    variants = sorted({e["variant"] for e in manifest["entries"]})

    rows = []
    for item in job["items"]:
        rows.append('<section class="line">')
        rows.append(
            f'<h2>{item["n"]:02d} · {html.escape(item["path"])}[{item["index"]}]</h2>'
        )
        rows.append(f'<p class="en">{html.escape(item["en"])}</p>')
        rows.append(f'<p class="ja">{html.escape(item["ja"])}</p>')
        for variant in variants:
            rows.append(f'<h3>{variant}</h3><div class="takes">')
            for voice in voices:
                entry = by_key.get((item["n"], variant, voice))
                if not entry:
                    continue
                drop = (
                    f' · dropped {entry["droppedCount"]}'
                    if entry["droppedCount"]
                    else ""
                )
                rel = entry["file"]
                for prefix in (".voice-preview/", "./.voice-preview/"):
                    if rel.startswith(prefix):
                        rel = rel[len(prefix):]
                rows.append(
                    '<figure>'
                    f'<figcaption>{voice} · {entry["seconds"]:.2f}s{drop}</figcaption>'
                    f'<audio controls preload="none" src="{html.escape(rel)}"></audio>'
                    "</figure>"
                )
            rows.append("</div>")
        rows.append("</section>")

    page = f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Umika JP voice pilot</title>
<style>
  body {{ font: 15px/1.6 system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; color: #12314a; }}
  h1 {{ font-size: 1.4rem; }}
  .line {{ border-top: 1px solid #d7e3ec; padding: 1rem 0; }}
  h2 {{ font-size: 1rem; margin: 0 0 .25rem; color: #2b6ea8; }}
  h3 {{ font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: #6b8199; margin: .8rem 0 .3rem; }}
  .en {{ margin: 0; color: #6b8199; }}
  .ja {{ margin: .1rem 0 .4rem; font-size: 1.05rem; }}
  .takes {{ display: flex; flex-wrap: wrap; gap: .8rem; }}
  figure {{ margin: 0; }}
  figcaption {{ font-size: .72rem; color: #6b8199; }}
  audio {{ height: 32px; }}
</style>
<h1>Umika JP voice pilot — {len(job["items"])} lines × {len(variants)} variants × {len(voices)} voices</h1>
<p>Approve a voice here, then the full 612-line library can be rendered the same way.
<strong>clean</strong> = pitch markers removed, every phoneme accepted by the {manifest["vocabSize"]}-token vocabulary.
<strong>raw</strong> = misaki's verbatim output, the way the upstream example feeds it.</p>
"""
    page += "".join(rows) + "</html>\n"
    with open(os.path.join(preview, "index.html"), "w", encoding="utf-8") as handle:
        handle.write(page)


def main():
    # IPA phonemes are not encodable in the Windows console default (cp1252), and
    # onnxruntime's constant-folding chatter drowns the report.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    import onnxruntime

    onnxruntime.set_default_logger_severity(3)

    parser = argparse.ArgumentParser(description="Render the Umika JP voice pilot")
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    preview = os.path.join(root, ".voice-preview")
    parser.add_argument("--job", default=os.path.join(preview, "pilot.json"))
    parser.add_argument("--model", default=os.path.join(preview, "models", "kokoro-v1.0.fp16.onnx"))
    parser.add_argument("--voices-file", default=os.path.join(preview, "models", "voices-v1.0.bin"))
    parser.add_argument("--out", default=os.path.join(preview, "wav"))
    parser.add_argument("--voices", default="")
    parser.add_argument("--variants", default="raw,clean")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--only-missing", action="store_true",
                        help="reuse clips already recorded in the previous manifest instead of re-rendering them")
    parser.add_argument(
        "--html-only",
        action="store_true",
        help="rebuild .voice-preview/index.html from the existing manifest, no synthesis",
    )
    args = parser.parse_args()

    if args.html_only:
        manifest_path = os.path.join(preview, "manifest.json")
        if not os.path.exists(manifest_path):
            print(f"kokoro-render: nothing to build a page from ({manifest_path})", file=sys.stderr)
            return 1
        with open(manifest_path, encoding="utf-8") as handle:
            manifest = json.load(handle)
        with open(args.job, encoding="utf-8") as handle:
            job = json.load(handle)
        write_index(preview, job, manifest)
        print(f"wrote {os.path.relpath(os.path.join(preview, 'index.html'), root)}")
        return 0

    for needed in (args.job, args.model, args.voices_file):
        if not os.path.exists(needed):
            print(f"kokoro-render: missing {needed}", file=sys.stderr)
            return 1

    with open(args.job, encoding="utf-8") as handle:
        job = json.load(handle)

    voices = [v.strip() for v in args.voices.split(",") if v.strip()] or job["voices"]
    variants = [v.strip() for v in args.variants.split(",") if v.strip()]
    unknown_variants = [v for v in variants if v not in ("raw", "clean")]
    if unknown_variants:
        print(f"kokoro-render: unknown variants {unknown_variants}", file=sys.stderr)
        return 1

    from misaki import ja
    from kokoro_onnx import Kokoro

    g2p = ja.JAG2P(version="pyopenjtalk")
    kokoro = Kokoro(args.model, args.voices_file)
    vocab = kokoro.tokenizer.vocab
    available = kokoro.get_voices()

    missing = [v for v in voices if v not in available]
    if missing:
        jp = [v for v in available if v.startswith("j")]
        print(f"kokoro-render: voices not in the model: {missing}", file=sys.stderr)
        print(f"kokoro-render: japanese voices available: {jp}", file=sys.stderr)
        return 1

    print(f"model  {os.path.basename(args.model)}")
    print(f"vocab  {len(vocab)} tokens, {len(available)} voices, japanese: {[v for v in available if v.startswith('j')]}")
    print(f"voices {voices}")
    print(f"speed  {args.speed}\n")

    previous = {}
    if args.only_missing:
        previous_path = os.path.join(preview, "manifest.json")
        if os.path.exists(previous_path):
            with open(previous_path, encoding="utf-8") as handle:
                for entry in json.load(handle)["entries"]:
                    previous[entry["file"]] = entry

    entries = []
    failures = []
    reused = 0
    for item in job["items"]:
        text = item["tts"]
        try:
            (phonemes_raw, tokens), g2p_mode, g2p_note = phonemize(text, g2p)
        except Exception as error:  # noqa: BLE001 - one bad line must not stop the run
            failures.append(f"{item['key']}: G2P failed ({type(error).__name__}: {error})")
            print(f"  !! {item['key']} G2P failed: {error}", flush=True)
            continue
        if g2p_mode != "direct":
            print(f"  ~~ {item['key']} used the {g2p_mode}: {g2p_note}", flush=True)
        phonemes_clean = normalize(rebuild_phonemes(tokens))
        available_phonemes = {"raw": phonemes_raw, "clean": phonemes_clean}

        if item["n"] % 50 == 1:
            print(f"  ... {item['n']}/{len(job['items'])}", flush=True)

        for variant in variants:
            phonemes = available_phonemes[variant]
            dropped = unknown_chars(phonemes, vocab)
            if item["n"] == 1:
                print(f"  [{variant}] {phonemes!r}")
                if dropped:
                    print(f"  [{variant}] unknown: {dropped}")
            for voice in voices:
                out_dir = os.path.join(args.out, variant, voice)
                os.makedirs(out_dir, exist_ok=True)
                name = f"{item['n']:02d}-{item['slug']}-i{item['index']}.wav"
                target = os.path.join(out_dir, name)

                relative = os.path.relpath(target, root).replace("\\", "/")
                cached = previous.get(relative)
                if (
                    args.only_missing
                    and cached
                    and os.path.exists(target)
                    and cached.get("bytes") == os.path.getsize(target)
                    and cached.get("text") == text
                    and cached.get("voice") == voice
                    and cached.get("speed", args.speed) == args.speed
                ):
                    entries.append(cached)
                    reused += 1
                    continue

                samples, rate = kokoro.create(
                    phonemes, voice=voice, speed=args.speed, is_phonemes=True
                )
                write_wav(target, samples, rate)

                audio = np.asarray(samples, dtype=np.float32)
                seconds = len(audio) / float(rate)
                peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
                rms = float(np.sqrt(np.mean(audio ** 2))) if len(audio) else 0.0

                record = {
                    "variant": variant,
                    "voice": voice,
                    "n": item["n"],
                    "key": item.get("key", ""),
                    "g2p": g2p_mode,
                    "path": f"{item['path']}[{item['index']}]",
                    "file": os.path.relpath(target, root).replace("\\", "/"),
                    "bytes": os.path.getsize(target),
                    "sampleRate": rate,
                    "seconds": round(seconds, 3),
                    "peak": round(peak, 4),
                    "rms": round(rms, 4),
                    "phonemes": phonemes,
                    "dropped": dropped,
                    "droppedCount": int(sum(dropped.values())),
                    # recorded so --only-missing can tell an updated translation
                    # from an unchanged one instead of reusing a stale clip
                    "text": text,
                    "speed": args.speed,
                }
                entries.append(record)

                problems = []
                if rate != SAMPLE_RATE:
                    problems.append(f"sample rate {rate}")
                if not MIN_SECONDS <= seconds <= MAX_SECONDS:
                    problems.append(f"duration {seconds:.2f}s")
                if peak < MIN_PEAK:
                    problems.append(f"near-silent (peak {peak:.3f})")
                if variant == "clean" and dropped:
                    problems.append(f"vocabulary dropped {sum(dropped.values())} phonemes {dropped}")
                if problems:
                    failures.append(f"{voice} {record['file']}: " + "; ".join(problems))

    manifest = {
        "job": os.path.relpath(args.job, root).replace("\\", "/"),
        "model": os.path.basename(args.model),
        "speed": args.speed,
        "vocabSize": len(vocab),
        "entries": entries,
        "failures": failures,
    }
    manifest_path = os.path.join(preview, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    write_index(preview, job, manifest)

    print("\nrendered:")
    if reused:
        print(f"  ({reused} clip(s) reused from the previous manifest, {len(entries) - reused} freshly synthesized)")
    for variant in sorted({e["variant"] for e in entries}):
        for voice in voices:
            group = [e for e in entries if e["variant"] == variant and e["voice"] == voice]
            if not group:
                continue
            total_s = sum(e["seconds"] for e in group)
            total_mb = sum(e["bytes"] for e in group) / 1e6
            worst_drop = max(e["droppedCount"] for e in group)
            print(
                f"  {variant:<5} {voice:<15} {len(group):>2} files  "
                f"{total_s:6.2f}s  {total_mb:5.2f}MB  worst dropped phonemes: {worst_drop}"
            )

    dropped_total = sum(
        e["droppedCount"] for e in entries if e["variant"] == "clean"
    )
    print(f"\nclean-variant phonemes rejected by the vocabulary: {dropped_total}")
    print(f"manifest -> {os.path.relpath(manifest_path, root)}")

    if failures:
        print(f"\n{len(failures)} render(s) failed checks:", file=sys.stderr)
        for line in failures[:40]:
            print(f"  - {line}", file=sys.stderr)
        return 1

    print(f"\nall {len(entries)} renders passed (non-silent, {SAMPLE_RATE}Hz mono)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
