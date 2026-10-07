"""Synthesise the Cat Season sound effects as 48 kHz mono WAVs.

Everything is "sewing-box foley": bone buttons tapped on a wooden table,
thread drawn through linen, plucked thread, scissors and a brass thimble.
Pitched material stays in D dorian so it sits inside the waltz.

Usage: python3 sfx.py OUT_DIR
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48_000
PEAK_DBFS = -3.0
RNG = np.random.default_rng(535)


def hz(name: str) -> float:
    steps = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    step = steps[name[0]]
    rest = name[1:]
    if rest[0] in "#b":
        step += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    midi = 12 * (int(rest) + 1) + step
    return 440.0 * 2 ** ((midi - 69) / 12)


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SR * seconds))


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def band(signal: np.ndarray, low: float, high: float, order: int = 2) -> np.ndarray:
    sos = butter(order, [low, high], btype="bandpass", fs=SR, output="sos")
    return sosfilt(sos, signal)


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    return sosfilt(butter(2, cutoff, fs=SR, output="sos"), signal)


def env(seconds: float, attack: float, decay: float) -> np.ndarray:
    """Linear attack then exponential decay (decay = time constant in seconds)."""
    t = t_axis(seconds)
    rise = np.clip(t / max(attack, 1e-4), 0, 1)
    return rise * np.exp(-np.maximum(t - attack, 0) / decay)


def modal(seconds: float, modes: list[tuple[float, float, float]]) -> np.ndarray:
    """Sum of damped sines: (frequency, decay time constant, amplitude)."""
    t = t_axis(seconds)
    out = np.zeros_like(t)
    for freq, decay, amp in modes:
        out += amp * np.sin(2 * np.pi * freq * t + RNG.uniform(0, np.pi)) * np.exp(-t / decay)
    return out * np.clip(t / 0.0008, 0, 1)


def pluck(freq: float, seconds: float, brightness: float = 0.5, damping: float = 0.996) -> np.ndarray:
    """Karplus-Strong plucked thread. Lower brightness = more muted."""
    size = int(SR / freq)
    buf = lowpass(RNG.uniform(-1, 1, size), 800 + brightness * 7000)
    out = np.empty(int(SR * seconds))
    for i in range(len(out)):
        j = i % size
        out[i] = buf[j]
        buf[j] = damping * 0.5 * (buf[j] + buf[(j + 1) % size])
    return out * np.clip(t_axis(seconds) / 0.002, 0, 1)


def bell(freq: float, seconds: float, decay: float = 0.45) -> np.ndarray:
    """Music-box tine: a pure fundamental with two quick inharmonic partials."""
    return modal(seconds, [(freq, decay, 1.0), (freq * 2.76, decay / 3, 0.35), (freq * 5.4, decay / 8, 0.18)])


def swish(seconds: float, low: float, high: float, attack: float) -> np.ndarray:
    """Thread drawn through linen: band-passed noise that swells then stops."""
    noise = band(RNG.normal(0, 1, int(SR * seconds)), low, high, order=4)
    t = t_axis(seconds)
    shape = np.where(t < attack, (t / attack) ** 2, np.exp(-(t - attack) / 0.012))
    return noise * shape


def mix(length: float, *parts: tuple[float, np.ndarray, float]) -> np.ndarray:
    """Place (start seconds, signal, gain) parts on a timeline."""
    out = silence(length)
    tail = int(SR * 0.006)
    for start, signal, gain in parts:
        signal = signal.copy()
        signal[-tail:] *= np.linspace(1, 0, tail)  # no part may stop dead, or it clicks
        i = int(start * SR)
        end = min(len(out), i + len(signal))
        out[i:end] += gain * signal[: end - i]
    return out


def finish(signal: np.ndarray, fade: float = 0.01) -> np.ndarray:
    signal = signal - np.mean(signal)
    n = int(SR * fade)
    signal[-n:] *= np.linspace(1, 0, n) ** 2
    signal[:16] *= np.linspace(0, 1, 16)
    return signal / np.max(np.abs(signal)) * 10 ** (PEAK_DBFS / 20)


# --- The cues ----------------------------------------------------------------

def button_tap() -> np.ndarray:
    return modal(0.08, [(1850, 0.012, 1.0), (2930, 0.008, 0.6), (4410, 0.005, 0.35), (420, 0.010, 0.5)]) + 0.25 * swish(0.08, 2000, 6000, 0.002)


def ui_click() -> np.ndarray:
    return finish(mix(0.09, (0, button_tap(), 1.0)), 0.02)


def tile_hover() -> np.ndarray:
    return finish(mix(0.1, (0, swish(0.1, 2500, 7000, 0.03), 1.0)), 0.03)


def tile_select() -> np.ndarray:
    pierce = band(RNG.normal(0, 1, int(SR * 0.012)), 3000, 9000) * np.exp(-t_axis(0.012) / 0.003)
    return finish(mix(0.16, (0, pierce, 1.0), (0.004, pluck(hz("A5"), 0.15, 0.6, 0.99), 0.45)), 0.04)


def ui_invalid() -> np.ndarray:
    thud = np.sin(2 * np.pi * 110 * t_axis(0.12)) * env(0.12, 0.002, 0.03)
    return finish(
        mix(0.3, (0, thud, 0.8), (0, pluck(hz("G3"), 0.25, 0.15, 0.985), 0.9), (0.075, pluck(hz("F#3"), 0.22, 0.12, 0.98), 0.9)),
        0.06,
    )


def stitch_run(notes: list[str], spacing: float, brightness: float, tail: float) -> np.ndarray:
    parts = []
    for i, name in enumerate(notes):
        start = i * spacing
        parts.append((start, swish(0.05, 1500, 5000, 0.035), 0.25))
        ring = tail if i == len(notes) - 1 else spacing * 2.5
        parts.append((start + 0.035, pluck(hz(name), ring, brightness, 0.997), 1.0))
    return mix(spacing * len(notes) + tail + 0.05, *parts)


def match_stitch() -> np.ndarray:
    return finish(stitch_run(["D5", "F5", "A5"], 0.07, 0.55, 0.32), 0.08)


def cascade() -> np.ndarray:
    return finish(stitch_run(["A5", "C6", "E6"], 0.055, 0.7, 0.26), 0.08)


def shuffle() -> np.ndarray:
    length = 0.48
    rustle = np.zeros(int(SR * length))
    for _ in range(46):
        grain = swish(0.03, 800, 4200, 0.008)
        start = int(RNG.beta(1.6, 2.4) * (len(rustle) - len(grain)))
        rustle[start : start + len(grain)] += RNG.uniform(0.3, 1.0) * grain
    hoop = modal(0.12, [(240, 0.035, 1.0), (610, 0.02, 0.5), (1320, 0.008, 0.2)])
    return finish(mix(length, (0, rustle, 0.7), (0, hoop, 0.8)), 0.06)


def scissor_snip() -> np.ndarray:
    def blade() -> np.ndarray:
        shear = band(RNG.normal(0, 1, int(SR * 0.03)), 4000, 11000) * env(0.03, 0.004, 0.006)
        ring = modal(0.09, [(3100, 0.025, 0.6), (4870, 0.018, 0.4), (7250, 0.01, 0.3)])
        return mix(0.09, (0, shear, 0.7), (0.003, ring, 0.5))

    return finish(mix(0.2, (0, blade(), 0.75), (0.05, blade(), 1.0)), 0.04)


def ui_confirm() -> np.ndarray:
    return finish(
        mix(0.5, (0, button_tap(), 0.6), (0.01, pluck(hz("D5"), 0.3, 0.75), 0.8), (0.09, pluck(hz("A5"), 0.4, 0.8), 0.8)),
        0.1,
    )


def hint_thimble() -> np.ndarray:
    tink = modal(0.3, [(2350, 0.11, 1.0), (5980, 0.04, 0.5), (9100, 0.015, 0.2)])
    return finish(mix(0.3, (0, tink, 1.0), (0.12, 0.5 * tink, 0.5)), 0.08)


def win_sampler() -> np.ndarray:
    run = ["D5", "F5", "A5", "C6", "D6"]
    parts = [(i * 0.11, bell(hz(name), 1.4, 0.35), 0.7) for i, name in enumerate(run)]
    chord_at = len(run) * 0.11 + 0.08
    parts += [(chord_at, bell(hz(name), 1.3, 0.6), 0.55) for name in ("A5", "D6", "F6")]
    parts += [(chord_at, pluck(hz(name), 1.3, 0.5, 0.998), 0.5) for name in ("D3", "A3", "F4")]
    return finish(mix(chord_at + 1.3, *parts), 0.3)


def lose_loose_thread() -> np.ndarray:
    run = ["A4", "G4", "F4", "E4"]
    parts = [(i * 0.18, pluck(hz(name), 0.5, 0.3, 0.995), 0.8) for i, name in enumerate(run)]
    parts.append((0.76, pluck(hz("D4"), 1.0, 0.22, 0.998), 0.9))
    parts.append((0.76, pluck(hz("D3"), 1.0, 0.18, 0.998), 0.6))
    return finish(mix(1.8, *parts), 0.3)


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


def main(out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, make in CUES.items():
        signal = make()
        wavfile.write(out / f"{name}.wav", SR, (signal * 32767).astype(np.int16))
        print(f"{name}: {len(signal) / SR:.3f}s")


if __name__ == "__main__":
    main(sys.argv[1])
