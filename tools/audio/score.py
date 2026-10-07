"""Compose "The Sampler Waltz" as a Standard MIDI File.

A slow parlour waltz in D dorian at 80 BPM, 3/4. Three beats to a bar is the
match-3 rhythm; the celesta "three stitches" motif (three repeated notes and a
lift) opens every section. The form is 40 bars = 90.000 s exactly, and the
file repeats it three times so the renderer can cut the middle pass as a
seamless loop (see build.py).

Usage: python3 score.py out.mid
"""

from __future__ import annotations

import random
import struct
import sys

PPQ = 480
BPM = 80
BAR = 3 * PPQ
LOOP_BARS = 40
PASSES = 3
TAIL_BARS = 3
E = PPQ // 2  # eighth note

NOTE_INDEX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def n(name: str) -> int:
    """'C#4' -> 61, 'Bb3' -> 58."""
    step = NOTE_INDEX[name[0]]
    rest = name[1:]
    if rest.startswith("#"):
        step += 1
        rest = rest[1:]
    elif rest.startswith("b"):
        step -= 1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + step


# --- Harmony -------------------------------------------------------------
# Chord = (bass root, triad for the guitar "pah-pah").
CHORDS = {
    "Dm": ("D2", ["D3", "F3", "A3"]),
    "G": ("G2", ["D3", "G3", "B3"]),
    "C": ("C3", ["C3", "E3", "G3"]),
    "Bb": ("Bb2", ["D3", "F3", "Bb3"]),
    "F": ("F2", ["C3", "F3", "A3"]),
    "Gm": ("G2", ["D3", "G3", "Bb3"]),
    "A7": ("A2", ["C#3", "G3", "A3"]),
    "Am": ("A2", ["C3", "E3", "A3"]),
}

INTRO = ["Dm", "G", "Dm", "G"]
SECTION_A = ["Dm", "G", "Dm", "C", "Bb", "F", "Gm", "A7"]
SECTION_A2 = ["Dm", "G", "Dm", "C", "Bb", "F", "A7", "Dm"]
SECTION_B = ["F", "C", "Bb", "F", "Dm", "G", "Bb", "A7"]
CODA = ["Dm", "G", "Bb", "A7"]
PROGRESSION = INTRO + SECTION_A + SECTION_A2 + SECTION_B + SECTION_A2[:7] + ["Am"] + CODA
assert len(PROGRESSION) == LOOP_BARS

# --- Melodies: lists of (note or None, length in eighths) per section ------
TUNE_A = [
    ("A4", 3), ("G4", 1), ("F4", 2),
    ("G4", 2), ("B4", 2), ("D5", 2),
    ("A4", 6),
    ("G4", 1), ("A4", 1), ("G4", 2), ("E4", 2),
    ("F4", 3), ("G4", 1), ("A4", 2),
    ("C5", 2), ("A4", 2), ("F4", 2),
    ("G4", 1), ("A4", 1), ("Bb4", 2), ("A4", 2),
    ("A4", 3), ("G4", 1), ("E4", 2),
]
TUNE_A2 = [
    ("D5", 3), ("C5", 1), ("A4", 2),
    ("B4", 2), ("G4", 2), ("B4", 2),
    ("A4", 2), ("F4", 2), ("D4", 2),
    ("E4", 3), ("F4", 1), ("G4", 2),
    ("F4", 2), ("D4", 2), ("F4", 2),
    ("A4", 2), ("C5", 2), ("A4", 2),
    ("A4", 2), ("G4", 2), ("E4", 2),
    ("D4", 6),
]
TUNE_B_BASSOON = [
    ("A3", 2), ("C4", 2), ("F4", 2),
    ("E4", 4), ("G3", 2),
    ("D4", 2), ("F4", 2), ("D4", 2),
    ("C4", 6),
    ("A3", 2), ("D4", 2), ("F4", 2),
    ("B3", 3), ("D4", 1), ("G4", 2),
    ("F4", 2), ("D4", 2), ("Bb3", 2),
    ("C#4", 4), ("E4", 2),
]
TUNE_B_FLUTE = [
    ("F5", 6), ("E5", 6), ("D5", 6), ("C5", 4), (None, 2),
    ("D5", 6), ("B4", 3), ("D5", 3), ("D5", 6), ("C#5", 4), ("E5", 2),
]
# The A'' pass ends on A minor so the coda can climb back to the top.
TUNE_A3 = TUNE_A2[:-1] + [("E4", 2), ("A4", 4)]
STITCHES = [("A5", 1), ("A5", 1), ("A5", 1), ("D6", 3)]  # the three-stitch motif
STITCHES_LOW = [("F5", 1), ("F5", 1), ("F5", 1), ("A5", 3)]
CODA_CELESTA = [
    ("D5", 1), ("F5", 1), ("A5", 1), ("D6", 3),
    ("B5", 1), ("G5", 1), ("D5", 1), ("B4", 3),
    ("D5", 1), ("F5", 1), ("Bb5", 1), ("D6", 3),
    ("C#6", 2), ("A5", 2), ("E5", 2),
]

# --- Channels (General MIDI programs, 0-indexed) -------------------------
CH = {
    "clarinet": (0, 71),
    "bassoon": (1, 70),
    "flute": (2, 73),
    "guitar": (3, 24),
    "pizz": (4, 45),
    "celesta": (5, 8),
    "strings": (6, 49),
    "musicbox": (7, 10),
}
VOLUME = {"clarinet": 92, "bassoon": 96, "flute": 70, "guitar": 84, "pizz": 100, "celesta": 70, "strings": 52, "musicbox": 58}
PAN = {"clarinet": 56, "bassoon": 74, "flute": 84, "guitar": 44, "pizz": 64, "celesta": 92, "strings": 64, "musicbox": 30}


class Score:
    def __init__(self, seed: int) -> None:
        self.events: dict[str, list[tuple[int, int, int, int]]] = {name: [] for name in CH}
        self.rng = random.Random(seed)

    def note(self, part: str, tick: int, pitch: int, length: int, vel: int) -> None:
        vel = max(1, min(127, vel + self.rng.randint(-5, 5)))
        self.events[part].append((tick, pitch, length, vel))

    def line(self, part: str, start_bar: int, tune: list[tuple[str | None, int]], vel: int, legato: float = 0.92, shift: int = 0) -> None:
        tick = start_bar * BAR
        for name, eighths in tune:
            length = eighths * E
            if name is not None:
                accent = 8 if tick % BAR == 0 else 0
                self.note(part, tick, n(name) + shift, int(length * legato), vel + accent)
            tick += length


def accompany(score: Score, offset: int) -> None:
    for bar, chord in enumerate(PROGRESSION):
        root, triad = CHORDS[chord]
        start = (offset + bar) * BAR
        in_b = 20 <= bar < 28
        score.note("pizz", start, n(root), PPQ, 92)
        if in_b or bar % 4 == 3:
            score.note("pizz", start + 2 * PPQ, n(root) + 7, PPQ, 70)
        for beat in (1, 2):
            for index, pitch in enumerate(triad):
                score.note("guitar", start + beat * PPQ + index * 6, n(pitch), int(PPQ * 0.8), 58 if beat == 1 else 50)
        if 12 <= bar < 36:
            for pitch in triad[1:]:
                score.note("strings", start, n(pitch) + 12, BAR - 20, 46)


def melody(score: Score, offset: int) -> None:
    o = offset
    score.line("celesta", o + 0, STITCHES, 62, legato=0.5)
    score.line("celesta", o + 2, STITCHES_LOW, 58, legato=0.5)
    score.line("clarinet", o + 4, TUNE_A, 78)
    score.line("celesta", o + 12, STITCHES, 54, legato=0.5)
    score.line("clarinet", o + 12, TUNE_A2, 76)
    score.line("flute", o + 12, [(None, 6)] * 4 + [("F5", 6), ("A5", 6), ("E5", 6), ("F5", 6)], 54)
    score.line("bassoon", o + 20, TUNE_B_BASSOON, 82)
    score.line("flute", o + 20, TUNE_B_FLUTE, 60)
    score.line("clarinet", o + 28, TUNE_A3, 80)
    arpeggio = []
    for chord in PROGRESSION[28:36]:
        triad = CHORDS[chord][1]
        arpeggio += [(f"{p[:-1]}{int(p[-1]) + 2}", 1) for p in triad] + [(None, 3)]
    score.line("musicbox", o + 28, arpeggio, 56, legato=0.6)
    score.line("celesta", o + 36, CODA_CELESTA, 64, legato=0.6)


def var_len(value: int) -> bytes:
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.insert(0, (value & 0x7F) | 0x80)
        value >>= 7
    return bytes(out)


def track_bytes(events: list[tuple[int, bytes]]) -> bytes:
    data = b""
    last = 0
    for tick, msg in sorted(events, key=lambda item: (item[0], item[1][0] & 0xF0 != 0x80)):
        data += var_len(tick - last) + msg
        last = tick
    data += b"\x00\xff\x2f\x00"
    return b"MTrk" + struct.pack(">I", len(data)) + data


def build(path: str) -> None:
    score = Score(seed=1121)
    for rep in range(PASSES):
        score.rng.seed(1121)  # identical humanisation every pass keeps the loop seam exact
        accompany(score, rep * LOOP_BARS)
        melody(score, rep * LOOP_BARS)

    tempo = 60_000_000 // BPM
    end = (PASSES * LOOP_BARS + TAIL_BARS) * BAR
    meta = [
        (0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
        (0, b"\xff\x58\x04\x03\x02\x18\x08"),
        (end, b"\xff\x01\x00"),
    ]
    tracks = [track_bytes(meta)]
    for part, (channel, program) in CH.items():
        evs: list[tuple[int, bytes]] = [
            (0, bytes([0xC0 | channel, program])),
            (0, bytes([0xB0 | channel, 7, VOLUME[part]])),
            (0, bytes([0xB0 | channel, 10, PAN[part]])),
            (0, bytes([0xB0 | channel, 91, 40])),
            (0, bytes([0xB0 | channel, 93, 0])),
        ]
        for tick, pitch, length, vel in score.events[part]:
            evs.append((tick, bytes([0x90 | channel, pitch, vel])))
            evs.append((tick + length, bytes([0x80 | channel, pitch, 0])))
        tracks.append(track_bytes(evs))

    header = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), PPQ)
    with open(path, "wb") as handle:
        handle.write(header + b"".join(tracks))


if __name__ == "__main__":
    build(sys.argv[1])
