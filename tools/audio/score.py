"""Compose "The Sampler Waltz" (2026 rescore) as MIDI plus an audiokit render spec.

A parlour waltz in D dorian (B sections in F major) at 90 BPM, 3/4.
48 bars = 144 beats = 96.000 s exactly, so the loop is a whole number of
samples at both 44.1 and 48 kHz. The render folds the reverb/release tail
back onto bar 1 (audiokit `loop`), so the seam is continuous.

Form (bar numbers 1-based):
  1-4   intro   mallet waltz vamp, bottle-pluck "three stitches" motif
  5-12  A       Delicacy keys melody
  13-20 A'      keys melody + flute counter-line, pad enters
  21-28 B       F major, flute melody, keys broken chords, brushes enter
  29-36 B'      flute climbs higher, fuller pad
  37-44 A''     keys melody returns with music-box (Kinderjoy) twinkles
  45-48 coda    stitch motif climbs Bb-Gm-Em7b5-A7 back to the top

Usage: python score.py <work_dir>   -> writes waltz.mid and music_spec.json
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import mido

BPM = 90
TPB = 480
BEATS_PER_BAR = 3
LOOP_BARS = 48
LOOP_SECONDS = LOOP_BARS * BEATS_PER_BAR * 60 / BPM  # 96.0
MUSIC_LUFS = -18.0

VITAL = Path.home() / "Music" / "Vital"
SERUM = Path("/Library/Audio/Presets/Xfer Records/Serum 2 Presets/Presets/Factory")
PRESETS = {
    "keys": SERUM / "Keyboard" / "KY - Delicacy.SerumPreset",
    "flute": SERUM / "Woodwind" / "WIND - Flute.SerumPreset",
    "bottle": SERUM / "Pluck" / "PL - Plucked Bottle.SerumPreset",
    "music_box": SERUM / "Bell" / "BL - Kinderjoy.SerumPreset",
    "mallet": VITAL / "Yuli Yolo" / "Presets" / "Factory Presets" / "Easy Mallet.vital",
    "pad": VITAL / "In The Mix" / "Presets" / "Analog Pad.vital",
}

NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def n(name: str) -> int:
    """'C#4' -> 61, 'Bb3' -> 58."""
    step = NOTE_INDEX[name[0]]
    rest = name[1:]
    if rest.startswith("#"):
        step, rest = step + 1, rest[1:]
    elif rest.startswith("b"):
        step, rest = step - 1, rest[1:]
    return 12 * (int(rest) + 1) + step


# --- Harmony: chord -> (bass root, upper triad voiced around D4-A4) -----------
CHORDS = {
    "Dm": ("D2", ["D4", "F4", "A4"]),
    "G": ("G2", ["D4", "G4", "B4"]),
    "C": ("C3", ["E4", "G4", "C5"]),
    "C/E": ("E2", ["E4", "G4", "C5"]),
    "C7": ("C3", ["E4", "Bb4", "C5"]),
    "Bb": ("Bb2", ["D4", "F4", "Bb4"]),
    "F": ("F2", ["C4", "F4", "A4"]),
    "Gm": ("G2", ["D4", "G4", "Bb4"]),
    "Am": ("A2", ["C4", "E4", "A4"]),
    "A7": ("A2", ["C#4", "G4", "A4"]),
    "Em7b5": ("E2", ["D4", "G4", "Bb4"]),
}
INTRO = ["Dm", "G", "Dm", "G"]
SEC_A = ["Dm", "G", "Dm", "C", "Bb", "F", "Gm", "A7"]
SEC_A2 = ["Dm", "G", "Dm", "C", "Bb", "F", "A7", "Dm"]
SEC_B = ["F", "C/E", "Dm", "Am", "Bb", "F", "Gm", "C7"]
SEC_B2 = ["F", "C/E", "Dm", "Bb", "Gm", "Dm", "Em7b5", "A7"]
CODA = ["Bb", "Gm", "Em7b5", "A7"]
PROGRESSION = INTRO + SEC_A + SEC_A2 + SEC_B + SEC_B2 + SEC_A2 + CODA
assert len(PROGRESSION) == LOOP_BARS

# --- Melodies: (note | None, length in eighths); 6 eighths per bar -----------
STITCH = [("A5", 1), ("A5", 1), ("A5", 1), ("D6", 3)]  # three stitches and a lift
STITCH_LOW = [("F5", 1), ("F5", 1), ("F5", 1), ("A5", 3)]
TUNE_A = [
    ("A4", 1), ("A4", 1), ("A4", 1), ("D5", 3),
    ("B4", 2), ("A4", 2), ("G4", 2),
    ("F4", 4), ("A4", 2),
    ("G4", 3), ("E4", 1), ("C4", 2),
    ("D4", 1), ("D4", 1), ("D4", 1), ("F4", 3),
    ("A4", 2), ("C5", 2), ("A4", 2),
    ("Bb4", 2), ("A4", 2), ("G4", 2),
    ("E4", 2), ("A4", 4),
]
TUNE_A2 = [
    ("A4", 1), ("A4", 1), ("A4", 1), ("F5", 3),
    ("E5", 2), ("D5", 2), ("B4", 2),
    ("D5", 3), ("C5", 1), ("A4", 2),
    ("G4", 2), ("E4", 2), ("C5", 2),
    ("Bb4", 3), ("A4", 1), ("G4", 2),
    ("A4", 2), ("F4", 2), ("C5", 2),
    ("C#5", 2), ("E5", 2), ("G4", 2),
    ("F4", 2), ("D4", 4),
]
COUNTER_A2 = [(p, 6) for p in ("F5", "D5", "F5", "E5", "D5", "C5", "C#5", "D5")]
TUNE_B = [
    ("C5", 4), ("A4", 2),
    ("G4", 4), ("C5", 2),
    ("F5", 4), ("E5", 1), ("D5", 1),
    ("E5", 6),
    ("D5", 4), ("F5", 2),
    ("C5", 4), ("A4", 2),
    ("Bb4", 2), ("D5", 2), ("G5", 2),
    ("E5", 4), ("C5", 2),
]
TUNE_B2 = [
    ("A5", 4), ("F5", 2),
    ("G5", 4), ("E5", 2),
    ("F5", 2), ("A5", 2), ("D5", 2),
    ("D5", 4), ("F5", 2),
    ("Bb5", 3), ("A5", 1), ("G5", 2),
    ("F5", 2), ("D5", 2), ("A4", 2),
    ("Bb4", 2), ("D5", 2), ("E5", 2),
    ("C#5", 4), (None, 2),
]
CODA_TUNE = [
    ("D5", 1), ("D5", 1), ("D5", 1), ("F5", 3),
    ("D5", 1), ("D5", 1), ("D5", 1), ("G5", 3),
    ("E5", 1), ("E5", 1), ("E5", 1), ("Bb5", 3),
    ("C#5", 2), ("E5", 2), ("A5", 2),
]

PARTS = ["keys", "arp", "flute", "counter", "bottle", "music_box", "mallet", "pad", "bass", "brushes"]
CHANNEL = {part: i for i, part in enumerate(PARTS)}
CHANNEL["brushes"] = 9  # GM drum channel -> MS Basic brush kit
BRUSH_KICK, BRUSH_TAP, BRUSH_SWIRL, RIDE = 36, 38, 40, 51


class Score:
    def __init__(self, seed: int) -> None:
        self.notes: dict[str, list[tuple[float, float, int, int]]] = {p: [] for p in PARTS}
        self.rng = random.Random(seed)

    def add(self, part: str, beat: float, dur: float, pitch: int, vel: int) -> None:
        vel = max(1, min(127, vel + self.rng.randint(-6, 6)))
        if beat > 0:
            beat += self.rng.uniform(-0.012, 0.012)  # a hand, not a sequencer
        self.notes[part].append((max(0.0, beat), dur, pitch, vel))

    def line(self, part: str, bar: int, tune, vel: int, legato: float = 0.92, shift: int = 0) -> None:
        beat = bar * BEATS_PER_BAR
        for name, eighths in tune:
            length = eighths / 2
            if name is not None:
                accent = 8 if abs(beat % BEATS_PER_BAR) < 1e-9 else 0
                self.add(part, beat, length * legato, n(name) + shift, vel + accent)
            beat += length


def accompany(s: Score) -> None:
    for bar, chord in enumerate(PROGRESSION):
        root, triad = CHORDS[chord]
        start = bar * BEATS_PER_BAR
        in_b = 20 <= bar < 36
        # "oom": acoustic bass on 1; root-fifth walk in the B sections
        s.add("bass", start, 0.9, n(root), 88)
        if in_b or bar % 4 == 3:
            s.add("bass", start + 2, 0.8, n(root) + 7, 66)
        # "pah-pah": felt mallet triads on 2 and 3, lighter in the intro
        pah = 46 if bar < 4 else 58
        for beat in (1, 2):
            for pitch in triad:
                s.add("mallet", start + beat, 0.7, n(pitch), pah - (6 if beat == 2 else 0))
        # pad bed from A' to the end of A'' (root, fifth, tenth)
        if 12 <= bar < 44:
            low = n(root) + 12
            for pitch in (low, low + 7, n(triad[1]) + 12 if in_b else low + 12):
                s.add("pad", start, BEATS_PER_BAR - 0.05, pitch, 52 if in_b else 44)
        # keys broken chords under the flute in B / B'
        if in_b:
            arp = [triad[0], triad[1], triad[2], triad[1]]
            for i, beat in enumerate((1, 1.5, 2, 2.5)):
                s.add("arp", start + beat, 0.45, n(arp[i]) + 12, 54)
        # brushes from B to the end of A''
        if 20 <= bar < 44:
            s.add("brushes", start, 0.25, BRUSH_KICK, 46)
            s.add("brushes", start + 1, 0.25, BRUSH_TAP, 36)
            s.add("brushes", start + 2, 0.25, BRUSH_TAP, 32)
            if bar % 2 == 1:
                s.add("brushes", start + 2.5, 0.25, BRUSH_SWIRL, 26)
            s.add("brushes", start, 0.25, RIDE, 22)


def melody(s: Score) -> None:
    s.line("bottle", 0, STITCH, 70, legato=0.6)
    s.line("bottle", 2, STITCH_LOW, 64, legato=0.6)
    s.line("keys", 4, TUNE_A, 80)
    s.line("keys", 12, TUNE_A2, 78)
    s.line("counter", 12, COUNTER_A2, 60, legato=0.96)
    s.line("bottle", 12, STITCH, 52, legato=0.6)
    s.line("flute", 20, TUNE_B, 74, legato=0.95)
    s.line("flute", 28, TUNE_B2, 78, legato=0.95)
    s.line("keys", 36, TUNE_A2, 80)
    twinkle = []
    for chord in SEC_A2:
        triad = CHORDS[chord][1]
        # Kinderjoy sounds two octaves up: these play around D6-A6
        twinkle += [(p, 1) for p in triad] + [(None, 3)]
    s.line("music_box", 36, twinkle, 60, legato=0.6)
    s.line("bottle", 44, CODA_TUNE, 72, legato=0.6)
    s.line("keys", 44, CODA_TUNE, 56, legato=0.8, shift=-12)


def write_midi(s: Score, path: Path) -> None:
    mf = mido.MidiFile(ticks_per_beat=TPB)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM), time=0))
    meta.append(mido.MetaMessage("time_signature", numerator=3, denominator=4, time=0))
    mf.tracks.append(meta)
    for part in PARTS:
        ch = CHANNEL[part]
        events = []
        for beat, dur, pitch, vel in s.notes[part]:
            on, off = round(beat * TPB), round((beat + dur) * TPB)
            events.append((on, 1, mido.Message("note_on", note=pitch, velocity=vel, channel=ch)))
            events.append((off, 0, mido.Message("note_off", note=pitch, velocity=0, channel=ch)))
        events.sort(key=lambda e: (e[0], e[1]))
        track, last = mido.MidiTrack(), 0
        for tick, _, msg in events:
            track.append(msg.copy(time=tick - last))
            last = tick
        mf.tracks.append(track)
    mf.save(path)


def reverb(room: float, wet: float) -> dict:
    return {"type": "Reverb", "room_size": room, "wet_level": wet, "dry_level": 1 - wet / 2, "width": 0.9}


def spec(midi: Path, out: Path) -> dict:
    track = {part: i + 1 for i, part in enumerate(PARTS)}

    def plug(kind: str, part: str) -> dict:
        return {"type": kind, "preset": str(PRESETS[part])}

    return {
        "out": str(out), "lufs": MUSIC_LUFS, "ceiling_dbtp": -1.0, "loop": LOOP_SECONDS, "tail": 5.0,
        "png": True, "stems_dir": str(out.parent / "music_stems"),
        "master_fx": [
            {"type": "Compressor", "threshold_db": -20, "ratio": 1.8, "attack_ms": 25, "release_ms": 250},
        ],
        "tracks": [
            {"name": "keys", "midi": str(midi), "track": track["keys"], "instrument": plug("serum2", "keys"),
             "gain_db": 0, "pan": -0.1, "fx": [reverb(0.55, 0.2)]},
            {"name": "arp", "midi": str(midi), "track": track["arp"], "instrument": plug("serum2", "keys"),
             "gain_db": -7, "pan": -0.3, "fx": [reverb(0.6, 0.24)]},
            {"name": "flute", "midi": str(midi), "track": track["flute"], "instrument": plug("serum2", "flute"),
             "gain_db": -4, "pan": 0.2, "fx": [reverb(0.7, 0.26)]},
            {"name": "counter", "midi": str(midi), "track": track["counter"], "instrument": plug("serum2", "flute"),
             "gain_db": -10, "pan": 0.35, "fx": [reverb(0.75, 0.3)]},
            {"name": "bottle", "midi": str(midi), "track": track["bottle"], "instrument": plug("serum2", "bottle"),
             "gain_db": -1, "pan": 0.35, "fx": [reverb(0.6, 0.24)]},
            {"name": "music_box", "midi": str(midi), "track": track["music_box"],
             "instrument": plug("serum2", "music_box"), "gain_db": -15, "pan": -0.4,
             "fx": [{"type": "LowpassFilter", "cutoff_frequency_hz": 7000}, reverb(0.75, 0.3)]},
            {"name": "mallet", "midi": str(midi), "track": track["mallet"], "instrument": plug("vital", "mallet"),
             "transpose": 12,  # Easy Mallet sounds an octave below the played key
             "gain_db": -5, "pan": -0.25, "fx": [reverb(0.5, 0.16)]},
            {"name": "pad", "midi": str(midi), "track": track["pad"], "instrument": plug("vital", "pad"),
             "gain_db": -13, "pan": 0.0,
             "fx": [{"type": "HighShelfFilter", "cutoff_frequency_hz": 1500, "gain_db": 4}, reverb(0.8, 0.3)]},
            {"name": "bass", "midi": str(midi), "track": track["bass"],
             "instrument": {"type": "fluidsynth", "program": 32, "gain": 0.6}, "gain_db": 2, "pan": 0.0,
             "fx": [{"type": "HighpassFilter", "cutoff_frequency_hz": 38}, reverb(0.4, 0.1)]},
            {"name": "brushes", "midi": str(midi), "track": track["brushes"],
             "instrument": {"type": "fluidsynth", "program": 40, "gain": 0.6}, "gain_db": -5, "pan": 0.1,
             "fx": [reverb(0.5, 0.18)]},
        ],
    }


def main(work: str) -> None:
    out_dir = Path(work)
    out_dir.mkdir(parents=True, exist_ok=True)
    s = Score(seed=1121)
    accompany(s)
    melody(s)
    midi = out_dir / "waltz.mid"
    write_midi(s, midi)
    (out_dir / "music_spec.json").write_text(json.dumps(spec(midi, out_dir / "waltz.wav"), indent=1))
    print(f"wrote {midi} ({sum(len(v) for v in s.notes.values())} notes, loop {LOOP_SECONDS:.3f} s)")


if __name__ == "__main__":
    main(sys.argv[1])
