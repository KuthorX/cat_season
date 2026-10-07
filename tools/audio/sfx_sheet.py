"""The SFX "source sheet": every pitched hit the sound effects need, one note per slot.

One audiokit spec renders all of it in a single process (one stem per
instrument), then `sfx.py` cuts the slots out and layers them with numpy foley.

Instruments (all within the allowed scope):
  ceramic   Vital "Ceramic" (Databroth)       glassy needle / button ticks (sounds ~3 oct up)
  bottle    Serum 2 "PL - Plucked Bottle"     plucked-thread tones, at pitch
  joy       Serum 2 "BL - Kinderjoy"          music-box / thimble tines (sounds 1-2 oct up)
  mallet    Vital "Easy Mallet" (Yuli Yolo)   soft felt body for knocks and low chords (sounds 1 oct down)
  wood      MS Basic GM 115 Woodblock         bone-button-on-walnut tap

Usage: python sfx_sheet.py <work_dir>   -> writes sfx_sheet.mid and sfx_spec.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import mido

from score import PRESETS, n

SLOT_SECONDS = 4.0
BPM = 120  # one beat = 0.5 s
TPB = 480
CERAMIC = Path.home() / "Music/Vital/Databroth/Presets/Factory Presets/Ceramic.vital"

# key -> (pitch, hold seconds, velocity), per instrument, in slot order
SHEET: dict[str, dict[str, tuple[int, float, int]]] = {
    "ceramic": {
        "tick_low": (n("D4"), 0.08, 96),
        "tick_mid": (n("A4"), 0.08, 96),
        "tick_high": (n("D5"), 0.08, 96),
        "tick_top": (n("A5"), 0.08, 90),
    },
    "bottle": {name: (n(name), 0.25, 100) for name in (
        "F#3", "G3", "D4", "E4", "F4", "G4", "A4", "D5", "F5", "A5", "C6", "D6", "E6")},
    "joy": {  # written two octaves below what sounds
        "D3": (n("D3"), 0.4, 96), "F3": (n("F3"), 0.4, 96), "A3": (n("A3"), 0.4, 96),
        "C4": (n("C4"), 0.4, 96), "D4": (n("D4"), 0.4, 96), "F4": (n("F4"), 0.4, 96),
        "D5": (n("D5"), 0.12, 100),
    },
    "mallet": {  # keys name the sounding pitch; Easy Mallet plays an octave below the key
        "G2": (n("G3"), 0.3, 100), "D3": (n("D4"), 1.2, 96), "A3": (n("A4"), 1.2, 96),
        "D4": (n("D5"), 1.0, 96), "F4": (n("F5"), 1.2, 96),
    },
    "wood": {"high": (n("C6"), 0.1, 100), "low": (n("E4"), 0.1, 100)},
}
TRACKS = list(SHEET)
GM_WOODBLOCK = 115


def slot_start(index: int) -> float:
    return index * SLOT_SECONDS


def write_midi(path: Path) -> None:
    mf = mido.MidiFile(ticks_per_beat=TPB)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM), time=0))
    mf.tracks.append(meta)
    beat_s = 60 / BPM
    for ch, inst in enumerate(TRACKS):
        events = []
        for i, (pitch, hold, vel) in enumerate(SHEET[inst].values()):
            on = round(slot_start(i) / beat_s * TPB)
            off = round((slot_start(i) + hold) / beat_s * TPB)
            events.append((on, 1, mido.Message("note_on", note=pitch, velocity=vel, channel=ch)))
            events.append((off, 0, mido.Message("note_off", note=pitch, velocity=0, channel=ch)))
        events.sort(key=lambda e: (e[0], e[1]))
        track, last = mido.MidiTrack(), 0
        for tick, _, msg in events:
            track.append(msg.copy(time=tick - last))
            last = tick
        mf.tracks.append(track)
    mf.save(path)


def spec(midi: Path, work: Path) -> dict:
    instruments = {
        "ceramic": {"type": "vital", "preset": str(CERAMIC)},
        "bottle": {"type": "serum2", "preset": str(PRESETS["bottle"])},
        "joy": {"type": "serum2", "preset": str(PRESETS["music_box"])},
        "mallet": {"type": "vital", "preset": str(PRESETS["mallet"])},
        "wood": {"type": "fluidsynth", "program": GM_WOODBLOCK, "gain": 0.6},
    }
    longest = max(len(v) for v in SHEET.values())
    return {
        "out": str(work / "sfx_sheet_mix.wav"), "lufs": -18, "tail": SLOT_SECONDS,
        "length": longest * SLOT_SECONDS, "stems_dir": str(work / "sfx_stems"),
        "tracks": [
            {"name": inst, "midi": str(midi), "track": i + 1, "instrument": instruments[inst]}
            for i, inst in enumerate(TRACKS)
        ],
    }


def main(work_dir: str) -> None:
    work = Path(work_dir)
    work.mkdir(parents=True, exist_ok=True)
    midi = work / "sfx_sheet.mid"
    write_midi(midi)
    (work / "sfx_spec.json").write_text(json.dumps(spec(midi, work), indent=1))
    print(f"wrote {midi} ({sum(len(v) for v in SHEET.values())} slots)")


if __name__ == "__main__":
    main(sys.argv[1])
