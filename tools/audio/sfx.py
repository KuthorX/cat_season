"""Layer the Cat Season sound effects from the rendered source sheet + numpy foley.

Everything is "sewing-box foley": bone buttons tapped on a walnut table,
thread drawn through linen, plucked thread, scissors and a brass thimble.
Pitched material stays in D dorian so it sits inside the waltz.

Each cue layers at least two sources (a rendered preset hit from
`sfx_sheet.py` plus another preset or numpy noise), then is enveloped,
filtered, loudness-normalised and peak-limited, so no cue is a bare
library sample.

Usage: python sfx.py <work_dir> <out_dir>   (needs <work_dir>/sfx_stems from the render)
"""

from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile as sf
from pedalboard import Pedalboard, Reverb
from scipy.signal import butter, resample_poly, sosfilt

from sfx_sheet import SHEET, SLOT_SECONDS

SR = 48_000
RENDER_SR = 44_100
SFX_LUFS = -16.0
CEILING_DBTP = -1.0
RNG = np.random.default_rng(535)
WORK = Path(".")


# --- DSP helpers -------------------------------------------------------------
def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def band(signal: np.ndarray, low: float, high: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, [low, high], btype="bandpass", fs=SR, output="sos"), signal)


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    return sosfilt(butter(2, cutoff, fs=SR, output="sos"), signal)


def highpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    return sosfilt(butter(2, cutoff, btype="highpass", fs=SR, output="sos"), signal)


def env(seconds: float, attack: float, decay: float) -> np.ndarray:
    t = t_axis(seconds)
    return np.clip(t / max(attack, 1e-4), 0, 1) * np.exp(-np.maximum(t - attack, 0) / decay)


def swish(seconds: float, low: float, high: float, attack: float) -> np.ndarray:
    """Thread drawn through linen: band-passed noise that swells then stops."""
    noise = band(RNG.normal(0, 1, int(SR * seconds)), low, high, order=4)
    t = t_axis(seconds)
    shape = np.where(t < attack, (t / attack) ** 2, np.exp(-(t - attack) / 0.012))
    return noise * shape / 3


def fade_tail(signal: np.ndarray, seconds: float) -> np.ndarray:
    out = signal.copy()
    k = min(len(out), max(1, int(SR * seconds)))
    out[-k:] *= np.linspace(1, 0, k) ** 2
    return out


def mix(length: float, *parts: tuple[float, np.ndarray, float]) -> np.ndarray:
    """Place (start seconds, signal, gain) parts on a timeline."""
    out = np.zeros(int(SR * length))
    for start, signal, gain in parts:
        i = int(start * SR)
        end = min(len(out), i + len(signal))
        out[i:end] += gain * fade_tail(signal, 0.006)[: end - i]
    return out


# --- Rendered source hits ----------------------------------------------------
@lru_cache(maxsize=None)
def stem(inst: str) -> np.ndarray:
    data, rate = sf.read(WORK / "sfx_stems" / f"{inst}.wav", always_2d=True)
    assert rate == RENDER_SR, rate
    return data.mean(axis=1)


def hit(inst: str, key: str, seconds: float) -> np.ndarray:
    """One rendered note, aligned to its onset, at 48 kHz, peak 1, faded out."""
    index = list(SHEET[inst]).index(key)
    start = int(index * SLOT_SECONDS * RENDER_SR)
    slot = stem(inst)[start : start + int(SLOT_SECONDS * RENDER_SR)]
    level = np.abs(slot)
    if level.max() < 1e-5:
        raise SystemExit(f"silent source hit: {inst}/{key}")
    onset = max(0, int(np.argmax(level > level.max() * 0.01)) - int(0.001 * RENDER_SR))
    x = resample_poly(slot[onset:], 160, 147)[: int(seconds * SR)]
    x = x - np.mean(x)
    x[:48] *= np.linspace(0, 1, 48)
    return fade_tail(x / np.max(np.abs(x)), min(0.05, seconds / 3))


# --- Cues ---------------------------------------------------------------------
def ui_click() -> np.ndarray:
    return mix(0.1, (0, hit("wood", "high", 0.09), 1.0), (0, hit("ceramic", "tick_mid", 0.08), 0.45))


def tile_hover() -> np.ndarray:
    return mix(0.11, (0, swish(0.1, 2500, 7000, 0.03), 1.0), (0.02, hit("ceramic", "tick_top", 0.06), 0.12))


def tile_select() -> np.ndarray:
    pierce = band(RNG.normal(0, 1, int(SR * 0.012)), 3000, 9000) * np.exp(-t_axis(0.012) / 0.003)
    return mix(
        0.17,
        (0, hit("ceramic", "tick_high", 0.1), 0.9),
        (0, pierce, 0.25),
        (0.004, hit("bottle", "A5", 0.16), 0.5),
    )


def ui_invalid() -> np.ndarray:
    thud = np.sin(2 * np.pi * 110 * t_axis(0.12)) * env(0.12, 0.002, 0.03)
    snag = mix(0.32, (0, hit("bottle", "G3", 0.25), 0.8), (0.075, hit("bottle", "F#3", 0.24), 0.8))
    return mix(0.32, (0, thud, 0.6), (0, hit("mallet", "G2", 0.3), 0.7), (0, lowpass(snag, 1800), 1.0))


def stitch_run(notes: list[str], spacing: float, tail: float) -> np.ndarray:
    parts = []
    for i, name in enumerate(notes):
        start = i * spacing
        ring = tail if i == len(notes) - 1 else spacing * 2.5
        parts.append((start, swish(0.05, 1500, 5000, 0.035), 0.3))
        parts.append((start + 0.035, hit("bottle", name, ring), 1.0))
    return mix(spacing * len(notes) + tail + 0.05, *parts)


def match_stitch() -> np.ndarray:
    run = stitch_run(["D5", "F5", "A5"], 0.07, 0.4)
    return mix(len(run) / SR, (0, run, 1.0), (0.175, hit("joy", "A3", 0.4), 0.22))


def cascade() -> np.ndarray:
    run = stitch_run(["A5", "C6", "E6"], 0.055, 0.3)
    return mix(len(run) / SR, (0, run, 1.0), (0.145, hit("ceramic", "tick_top", 0.08), 0.3))


def shuffle() -> np.ndarray:
    length = 0.48
    rustle = np.zeros(int(SR * length))
    for _ in range(46):
        grain = swish(0.03, 800, 4200, 0.008)
        start = int(RNG.beta(1.6, 2.4) * (len(rustle) - len(grain)))
        rustle[start : start + len(grain)] += RNG.uniform(0.3, 1.0) * grain
    return mix(length, (0, rustle, 0.9), (0, hit("wood", "low", 0.12), 0.7), (0, hit("mallet", "D3", 0.3), 0.5))


def scissor_snip() -> np.ndarray:
    def blade(tick: str) -> np.ndarray:
        shear = band(RNG.normal(0, 1, int(SR * 0.03)), 4000, 11000) * env(0.03, 0.004, 0.006)
        return mix(0.09, (0, shear, 0.6), (0.003, hit("ceramic", tick, 0.08), 0.8))

    return mix(0.21, (0, blade("tick_high"), 0.75), (0.05, blade("tick_top"), 1.0))


def ui_confirm() -> np.ndarray:
    return mix(
        0.5,
        (0, hit("wood", "high", 0.09), 0.45),
        (0.01, hit("bottle", "D5", 0.3), 0.8),
        (0.09, hit("bottle", "A5", 0.4), 0.8),
        (0.09, hit("joy", "D3", 0.4), 0.22),
    )


def hint_thimble() -> np.ndarray:
    tink = mix(0.3, (0, hit("joy", "D5", 0.3), 1.0), (0, hit("ceramic", "tick_top", 0.08), 0.3))
    return mix(0.32, (0, tink, 1.0), (0.12, tink, 0.5))


def win_sampler() -> np.ndarray:
    run = [("D3", "D5"), ("F3", "F5"), ("A3", "A5"), ("C4", "C6"), ("D4", "D6")]
    parts = []
    for i, (joy, bottle) in enumerate(run):
        parts += [(i * 0.11, hit("joy", joy, 1.2), 0.6), (i * 0.11, hit("bottle", bottle, 0.6), 0.35)]
    chord_at = len(run) * 0.11 + 0.08
    parts += [(chord_at, hit("joy", key, 1.3), 0.45) for key in ("A3", "D4", "F4")]
    parts += [(chord_at, hit("mallet", key, 1.3), 0.6) for key in ("D3", "A3", "F4")]
    dry = mix(chord_at + 1.3, *parts)
    room = Pedalboard([Reverb(room_size=0.4, wet_level=0.14, dry_level=0.9, width=0.0)])
    return room(dry.astype(np.float32)[None, :], SR)[0].astype(np.float64)


def lose_loose_thread() -> np.ndarray:
    run = ["A4", "G4", "F4", "E4"]
    parts = [(i * 0.18, hit("bottle", name, 0.5), 0.8) for i, name in enumerate(run)]
    parts += [(0.76, hit("bottle", "D4", 1.0), 0.9), (0.76, hit("mallet", "D3", 1.0), 0.7),
              (0.76, hit("mallet", "D4", 1.0), 0.35)]
    return lowpass(mix(1.8, *parts), 3200)


CUES = {
    "ui-click": ui_click,
    "ui-confirm": ui_confirm,
    "tile-hover": tile_hover,
    "tile-select": tile_select,
    "ui-invalid": ui_invalid,
    "match-stitch": match_stitch,
    "cascade": cascade,
    "shuffle": shuffle,
    "scissor-snip": scissor_snip,
    "hint-thimble": hint_thimble,
    "win-sampler": win_sampler,
    "lose-thread": lose_loose_thread,
}


# --- Mastering ------------------------------------------------------------------
def true_peak_db(x: np.ndarray) -> float:
    return float(20 * np.log10(np.max(np.abs(resample_poly(x, 4, 1))) + 1e-12))


def finish(signal: np.ndarray) -> np.ndarray:
    """DC/rumble removal, fades, -16 LUFS, true peak <= -1 dBTP (gain only, no limiter)."""
    x = highpass(signal - np.mean(signal), 40)
    x[:24] *= np.linspace(0, 1, 24)
    x = fade_tail(x, min(0.08, len(x) / SR / 4))
    padded = np.pad(x, (0, max(0, int(0.5 * SR) - len(x))))
    x = x * 10 ** ((SFX_LUFS - pyloudnorm.Meter(SR).integrated_loudness(padded)) / 20)
    over = true_peak_db(x) - CEILING_DBTP
    return x * 10 ** (-over / 20) if over > 0 else x


def main(work_dir: str, out_dir: str) -> None:
    global WORK
    WORK = Path(work_dir)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, make in CUES.items():
        signal = finish(make())
        sf.write(out / f"{name}.wav", signal.astype(np.float32), SR, subtype="PCM_16")
        print(f"{name}: {len(signal) / SR:.3f}s tp {true_peak_db(signal):.1f} dBTP")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
