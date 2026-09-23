#!/usr/bin/env python
"""Umika voice pack — step 3 of 3.

Turns the rendered WAV set into the shippable compressed set, and measures the
result against the masters instead of trusting the encoder.

Codec choice is not arbitrary: libsndfile 1.2's Opus encoder measures only ~7 dB
SNR even at 260 kbps (correlation 0.97), which is a broken output, not a bitrate
problem. Ogg Vorbis at compression_level 0.9 lands near 16 MB for the whole set
at ~22 dB SNR, and MP3 at the default level is marginally better at ~24 MB; both
decode cleanly in the DSH web client.

Every packed file is decoded back and compared with the WAV it came from, so a
silently truncated, empty or badly encoded file fails the run instead of shipping.

Usage:
  .voice-preview/.venv/Scripts/python.exe scripts/voice-pack.py
  ... --subtype MPEG_LAYER_III --compression-level 0.6   # mp3 alternative
"""

import argparse
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np
import soundfile as sf

MAX_DRIFT_SECONDS = 0.06
MIN_PEAK = 0.02
DEFAULT_MIN_SNR_DB = 15.0
EXTENSIONS = {"OPUS": ".ogg", "VORBIS": ".ogg", "MPEG_LAYER_III": ".mp3"}
CONTAINERS = {"OPUS": "OGG", "VORBIS": "OGG", "MPEG_LAYER_III": "MP3"}


def snr_db(original, decoded):
    length = min(len(original), len(decoded))
    if length == 0:
        return -100.0
    a = original[:length].astype(np.float32) / 32768.0
    b = decoded[:length].astype(np.float32) / 32768.0
    noise = a - b
    return float(10 * np.log10((np.sum(a**2) + 1e-12) / (np.sum(noise**2) + 1e-12)))


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    preview = os.path.join(root, ".voice-preview")

    parser = argparse.ArgumentParser(description="Pack the rendered WAV set into Ogg Opus")
    parser.add_argument("--job", default=os.path.join(preview, "job.json"))
    parser.add_argument("--wav-root", default=os.path.join(preview, "wav"))
    parser.add_argument("--out", default=os.path.join(preview, "opus"))
    parser.add_argument("--variant", default="clean")
    parser.add_argument("--voices", default="")
    parser.add_argument("--subtype", default="VORBIS", choices=["OPUS", "VORBIS", "MPEG_LAYER_III"])
    parser.add_argument("--compression-level", type=float, default=0.9,
                        help="libsndfile compression level: higher is smaller (Vorbis is unaffected by nothing else)")
    parser.add_argument("--min-ratio", type=float, default=5.0, help="fail below this size reduction")
    parser.add_argument("--min-snr", type=float, default=DEFAULT_MIN_SNR_DB,
                        help="fail a file whose SNR against the master falls below this")
    parser.add_argument("--manifest", default="",
                        help="also write the runtime lookup manifest here (the presenter fetches it)")
    args = parser.parse_args()

    with open(args.job, encoding="utf-8") as handle:
        job = json.load(handle)
    voices = [v.strip() for v in args.voices.split(",") if v.strip()] or job["voices"]

    container = CONTAINERS[args.subtype]
    extension = EXTENSIONS[args.subtype]
    print(
        f"subtype {args.subtype} ({container}), compression_level {args.compression_level}, "
        f"min SNR {args.min_snr} dB, variant {args.variant}, voices {voices}"
    )

    entries = []
    failures = []
    groups = {}
    for voice in voices:
        wav_dir = os.path.join(args.wav_root, args.variant, voice)
        out_dir = os.path.join(args.out, voice)
        os.makedirs(out_dir, exist_ok=True)

        wav_bytes = 0
        ogg_bytes = 0
        total_seconds = 0.0
        for item in job["items"]:
            name = f"{item['n']:02d}-{item['slug']}-i{item['index']}.wav"
            source = os.path.join(wav_dir, name)
            if not os.path.exists(source):
                failures.append(f"{voice}/{name}: no rendered WAV")
                continue
            target = os.path.join(out_dir, os.path.splitext(name)[0] + extension)

            data, rate = sf.read(source, dtype="int16")
            sf.write(
                target,
                data,
                rate,
                format=container,
                subtype=args.subtype,
                compression_level=args.compression_level,
            )
            back, rate_back = sf.read(target, dtype="int16")

            seconds = len(data) / float(rate)
            seconds_back = len(back) / float(rate_back)
            drift = seconds_back - seconds
            peak = float(np.max(np.abs(back.astype(np.float32) / 32768.0))) if len(back) else 0.0
            fidelity = snr_db(data, back)
            source_bytes = os.path.getsize(source)
            target_bytes = os.path.getsize(target)

            if rate_back != rate:
                failures.append(f"{voice}/{name}: sample rate {rate} -> {rate_back}")
            if abs(drift) > MAX_DRIFT_SECONDS:
                failures.append(f"{voice}/{name}: duration drift {drift:+.3f}s")
            if peak < MIN_PEAK:
                failures.append(f"{voice}/{name}: near-silent after packing (peak {peak:.3f})")
            if fidelity < args.min_snr:
                failures.append(f"{voice}/{name}: SNR {fidelity:.1f} dB below the {args.min_snr} dB floor")

            wav_bytes += source_bytes
            ogg_bytes += target_bytes
            total_seconds += seconds
            entries.append(
                {
                    "voice": voice,
                    "n": item["n"],
                    "key": item.get("key", ""),
                    "sampleRate": rate_back,
                    "seconds": round(seconds_back, 3),
                    "drift": round(drift, 4),
                    "snrDb": round(fidelity, 2),
                    "wavBytes": source_bytes,
                    "bytes": target_bytes,
                    "peak": round(peak, 4),
                    "file": os.path.relpath(target, root).replace("\\", "/"),
                }
            )

        ratio = wav_bytes / ogg_bytes if ogg_bytes else 0.0
        voice_entries = [e for e in entries if e["voice"] == voice]
        snrs = sorted(e["snrDb"] for e in voice_entries) or [0.0]
        groups[voice] = {
            "files": len(voice_entries),
            "seconds": round(total_seconds, 1),
            "wavBytes": wav_bytes,
            "bytes": ogg_bytes,
            "ratio": round(ratio, 2),
            "kbps": round(ogg_bytes * 8 / total_seconds / 1000, 1) if total_seconds else 0.0,
            "snrDbMin": snrs[0],
            "snrDbMedian": snrs[len(snrs) // 2],
        }
        if ratio < args.min_ratio:
            failures.append(f"{voice}: only {ratio:.2f}x smaller than WAV (want >= {args.min_ratio}x)")
        print(
            f"  {voice:<15} {groups[voice]['files']:>3} files  "
            f"{groups[voice]['seconds']:7.1f}s  {wav_bytes / 1e6:6.1f}MB -> {ogg_bytes / 1e6:5.1f}MB "
            f"({ratio:.1f}x, {groups[voice]['kbps']:.0f} kbps)  "
            f"SNR {snrs[0]:.1f}/{snrs[len(snrs) // 2]:.1f} dB (min/median)"
        )

    pack = {
        "job": os.path.relpath(args.job, root).replace("\\", "/"),
        "variant": args.variant,
        "subtype": args.subtype,
        "container": container,
        "compressionLevel": args.compression_level,
        "minSnrDb": args.min_snr,
        "groups": groups,
        "entries": entries,
        "failures": failures,
    }
    pack_path = os.path.join(preview, "pack.json")
    with open(pack_path, "w", encoding="utf-8") as handle:
        json.dump(pack, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    write_page(preview, job, pack, args)

    if args.manifest:
        # Runtime lookup: the presenter sees the same English string the core
        # banks hold, so the key is that string verbatim (all 653 are unique).
        files = {}
        for item in job["items"]:
            # values stay relative to the manifest, so more voices can be added
            # later as sibling directories without rewriting the runtime lookup
            files[item["en"]] = f"{voices[0]}/{item['n']:02d}-{item['slug']}-i{item['index']}{extension}"
        manifest = {
            "voice": voices[0],
            "lang": "ja",
            "codec": args.subtype,
            "source": job.get("source", "assets/whale-moe-core.js"),
            "count": len(files),
            "note": "Keys are the exact line strings from whale-moe-core.js; "
                    "values are files in this directory. Duplicate keys are impossible "
                    "because all source lines are unique.",
            "files": files,
        }
        os.makedirs(os.path.dirname(os.path.abspath(args.manifest)), exist_ok=True)
        with open(args.manifest, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=1, sort_keys=True)
            handle.write("\n")
        print(f"lookup manifest -> {os.path.relpath(args.manifest, root)} ({len(files)} entries)")

    print(f"\nmanifest -> {os.path.relpath(pack_path, root)}")
    if failures:
        print(f"{len(failures)} packed file(s) failed checks:", file=sys.stderr)
        for line in failures[:30]:
            print(f"  - {line}", file=sys.stderr)
        return 1
    total = sum(g["bytes"] for g in groups.values())
    print(f"all {len(entries)} files packed and re-decoded cleanly ({total / 1e6:.1f}MB total)")
    return 0


def write_page(preview, job, pack, args):
    """Listening page for the packed set, so the compression can be ear-checked."""
    import html

    by_key = {}
    for entry in pack["entries"]:
        by_key[(entry["n"], entry["voice"])] = entry
    voices = sorted(pack["groups"])

    rows = []
    for item in job["items"]:
        rows.append('<section class="line">')
        rows.append(f'<h2>{item["n"]:02d} · {html.escape(item["key"])}</h2>')
        rows.append(f'<p class="en">{html.escape(item["en"])}</p>')
        rows.append(f'<p class="ja">{html.escape(item["ja"])}</p>')
        rows.append('<div class="takes">')
        for voice in voices:
            entry = by_key.get((item["n"], voice))
            if not entry:
                continue
            rel = entry["file"]
            if rel.startswith(".voice-preview/"):
                rel = rel[len(".voice-preview/"):]
            rows.append(
                "<figure>"
                f'<figcaption>{voice} · {entry["seconds"]:.2f}s · {entry["bytes"] / 1e3:.1f}KB · '
                f'{entry["snrDb"]:.1f}dB</figcaption>'
                f'<audio controls preload="none" src="{html.escape(rel)}"></audio>'
                "</figure>"
            )
        rows.append("</div></section>")

    groups = "".join(
        f'<li>{voice}: {g["files"]} files, {g["seconds"]:.0f}s, {g["bytes"] / 1e6:.1f}MB '
        f'({g["ratio"]}x smaller than WAV, {g["kbps"]:.0f} kbps, SNR {g["snrDbMin"]:.1f}-{g["snrDbMedian"]:.1f} dB)</li>'
        for voice, g in sorted(pack["groups"].items())
    )
    page = f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Umika voice pack ({pack["subtype"]})</title>
<style>
  body {{ font: 15px/1.6 system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; color: #12314a; }}
  .line {{ border-top: 1px solid #d7e3ec; padding: 1rem 0; }}
  h2 {{ font-size: .95rem; margin: 0 0 .25rem; color: #2b6ea8; }}
  .en {{ margin: 0; color: #6b8199; }}
  .ja {{ margin: .1rem 0 .4rem; font-size: 1.05rem; }}
  .takes {{ display: flex; flex-wrap: wrap; gap: .8rem; }}
  figure {{ margin: 0; }}
  figcaption {{ font-size: .72rem; color: #6b8199; }}
  audio {{ height: 32px; }}
  ul {{ color: #6b8199; }}
</style>
<h1>Umika voice pack — {len(pack["entries"])} lines, {pack["subtype"]} (level {pack["compressionLevel"]})</h1>
<ul>{groups}</ul>
<p>Compressed copy of the rendered set; the WAV masters live in <code>wav/</code>.
Each file is listed with its SNR against the master.</p>
"""
    page += "".join(rows) + "</html>\n"
    with open(os.path.join(preview, "index-pack.html"), "w", encoding="utf-8") as handle:
        handle.write(page)


if __name__ == "__main__":
    sys.exit(main())
