"""Rebuild every Cat Season audio asset into public/assets/audio.

Needs python3 with numpy + scipy, fluidsynth and ffmpeg (libopus, libmp3lame).

  python3 tools/audio/build.py            # music + SFX
  python3 tools/audio/build.py --report   # also print duration / LUFS / true peak

The waltz is rendered as three identical passes; the middle pass is cut out so
the reverb tail of the previous bar is already present at the loop start,
which makes the loop seam bit-exact. It is normalised to -18 LUFS with a
single linear gain (no limiter), then encoded to Opus (primary) and MP3
(fallback for browsers without Ogg Opus).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "public" / "assets" / "audio"
SOUNDFONT = Path("/Applications/MuseScore 4.app/Contents/Resources/sound/MS Basic.sf3")
SR = 48_000
LOOP_SAMPLES = 40 * 108_000  # 40 bars of 3/4 at 80 BPM = 90 s
MUSIC_LUFS = -18.0
MUSIC_NAME = "sampler-waltz"

sys.path.insert(0, str(HERE))
import score  # noqa: E402
import sfx  # noqa: E402


def run(*args: str) -> str:
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return result.stdout + result.stderr


def loudness(path: Path) -> dict[str, float]:
    log = run("ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "apad=whole_dur=0.5,ebur128=peak=true", "-f", "null", "-")
    summary = log[log.rfind("Summary:") :]
    lufs = float(re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    momentary = [float(v) for v in re.findall(r"M:\s*(-?[\d.]+)", log)]
    duration = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)).strip())
    return {"duration": duration, "lufs": lufs, "max_momentary": max(momentary, default=-70.0), "true_peak": peak}


def build_music(tmp: Path) -> None:
    midi = tmp / "waltz.mid"
    raw = tmp / "waltz-raw.wav"
    score.build(str(midi))
    run(
        "fluidsynth", "-ni", "-q", "-g", "0.6", "-r", str(SR), "-o", "synth.chorus.active=0",
        "-F", str(raw), str(SOUNDFONT), str(midi),
    )
    rate, data = wavfile.read(raw)
    assert rate == SR
    audio = data.astype(np.float64) / 32768
    first, second = audio[LOOP_SAMPLES : 2 * LOOP_SAMPLES], audio[2 * LOOP_SAMPLES : 3 * LOOP_SAMPLES]
    if not np.array_equal(first, second):
        raise SystemExit("render passes differ; the loop would not be seamless")

    loop = tmp / "waltz-loop.wav"
    wavfile.write(loop, SR, (first * 32767).astype(np.int16))
    gain_db = MUSIC_LUFS - loudness(loop)["lufs"]
    leveled = np.clip(first * 10 ** (gain_db / 20), -1, 1)
    if np.max(np.abs(leveled)) > 10 ** (-1.5 / 20):
        raise SystemExit("music would clip at -18 LUFS; lower the mix instead of limiting")
    wavfile.write(loop, SR, (leveled * 32767).astype(np.int16))
    run("ffmpeg", "-y", "-v", "error", "-i", str(loop), "-c:a", "libopus", "-b:a", "80k", "-vbr", "on", str(OUT / f"{MUSIC_NAME}.ogg"))
    run("ffmpeg", "-y", "-v", "error", "-i", str(loop), "-c:a", "libmp3lame", "-b:a", "96k", str(OUT / f"{MUSIC_NAME}.mp3"))


def build_sfx(tmp: Path) -> None:
    sfx.main(str(tmp / "sfx"))
    for name in sfx.CUES:
        wav = tmp / "sfx" / f"{name}.wav"
        run("ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "48k", str(OUT / f"{name}.ogg"))
        run("ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "64k", str(OUT / f"{name}.mp3"))


def report() -> None:
    rows = {}
    for path in sorted(OUT.glob("*.ogg")):
        rows[path.name] = {**loudness(path), "bytes": path.stat().st_size}
    print(json.dumps(rows, indent=1))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as name:
        tmp = Path(name)
        build_music(tmp)
        build_sfx(tmp)
    if "--report" in sys.argv:
        report()


if __name__ == "__main__":
    main()
