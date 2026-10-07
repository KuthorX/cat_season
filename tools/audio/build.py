"""Rebuild every Cat Season audio asset into public/assets/audio.

Needs the offline audiokit toolchain in /tmp/audiokit (Vital + Serum 2 hosted
headless by pedalboard, fluidsynth + MS Basic.sf3, never plays audio or opens
windows) and ffmpeg with libopus + libmp3lame. Run with the audiokit venv:

  PY="arch -arm64 /tmp/audiokit/venv/bin/python"
  $PY tools/audio/build.py            # prepare -> render -> assemble
  $PY tools/audio/build.py --report   # also print duration / LUFS / true peak

Steps:
  prepare   score.py + sfx_sheet.py write MIDI and two audiokit specs
  render    two render.py runs (music, SFX source sheet), serialised by the
            shared lockf on /tmp/audiokit/render.lock
  assemble  music: wrap-around resample 44.1 -> 48 kHz (loop stays seamless),
            SFX: sfx.py layering; then Opus (primary) + MP3 (fallback)
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "public" / "assets" / "audio"
WORK = Path("/tmp/cat_season_audio")
AUDIOKIT = Path("/tmp/audiokit")
MUSIC_NAME = "sampler-waltz"
SR = 48_000

sys.path.insert(0, str(HERE))
import score  # noqa: E402
import sfx  # noqa: E402
import sfx_sheet  # noqa: E402


def run(*args: str) -> str:
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return result.stdout + result.stderr


def loudness(path: Path) -> dict[str, float]:
    log = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "apad=whole_dur=0.5,ebur128=peak=true", "-f", "null", "-")
    summary = log[log.rfind("Summary:") :]
    lufs = float(re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    duration = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)).strip())
    return {"duration": duration, "lufs": lufs, "true_peak": peak}


def prepare() -> None:
    score.main(str(WORK))
    sfx_sheet.main(str(WORK))


def render() -> None:
    for name in ("music_spec.json", "sfx_spec.json"):
        print(run(
            "lockf", "-t", "3600", str(AUDIOKIT / "render.lock"),
            "arch", "-arm64", str(AUDIOKIT / "venv/bin/python"), str(AUDIOKIT / "render.py"),
            str(WORK / name), "--report",
        )[-600:])


def build_music() -> None:
    data, rate = sf.read(WORK / "waltz.wav", always_2d=True)
    loop = data.T
    if loop.shape[1] != round(score.LOOP_SECONDS * rate):
        raise SystemExit(f"music loop is {loop.shape[1]} samples, expected {score.LOOP_SECONDS} s")
    # resample three copies and keep the middle so both loop edges see their true neighbours
    tiled = np.concatenate([loop, loop, loop], axis=1)
    up = resample_poly(tiled, SR // 300, rate // 300, axis=1)
    n = round(score.LOOP_SECONDS * SR)
    middle = up[:, n : 2 * n]
    wav = WORK / "waltz-48k.wav"
    sf.write(wav, middle.T.astype(np.float32), SR, subtype="PCM_16")
    run("ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "80k", "-vbr", "on", str(OUT / f"{MUSIC_NAME}.ogg"))
    run("ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "96k", str(OUT / f"{MUSIC_NAME}.mp3"))


def build_sfx(tmp: Path) -> None:
    sfx.main(str(WORK), str(tmp))
    for name in sfx.CUES:
        wav = tmp / f"{name}.wav"
        run("ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "48k", str(OUT / f"{name}.ogg"))
        run("ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "64k", str(OUT / f"{name}.mp3"))


def assemble() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_music()
    with tempfile.TemporaryDirectory() as name:
        build_sfx(Path(name))


def report() -> None:
    rows = {path.name: {**loudness(path), "bytes": path.stat().st_size} for path in sorted(OUT.glob("*.ogg"))}
    print(json.dumps(rows, indent=1))


def main() -> None:
    steps = [arg for arg in sys.argv[1:] if not arg.startswith("--")] or ["prepare", "render", "assemble"]
    for step in steps:
        {"prepare": prepare, "render": render, "assemble": assemble}[step]()
    if "--report" in sys.argv:
        report()


if __name__ == "__main__":
    main()
