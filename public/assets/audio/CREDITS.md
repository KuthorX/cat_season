# Audio Credits

All audio in this folder is original to Cat Season. Music and sound effects
were composed programmatically by AI (Claude) and rendered offline with
Vital / Serum 2 / MS Basic soundfont. Rebuild with `tools/audio/build.py`
(see `docs/audio-direction.md`).

- `sampler-waltz.ogg` / `.mp3`: "The Sampler Waltz" (2026 rescore), composed in code (`tools/audio/score.py`).
  - Serum 2 (Xfer Records) factory presets: `KY - Delicacy`, `WIND - Flute`, `PL - Plucked Bottle`, `BL - Kinderjoy`.
  - Vital (Matt Tytel) presets: `Easy Mallet` (Yuli Yolo pack), `Analog Pad` (In The Mix pack).
  - FluidSynth with the **MS Basic** SoundFont from MuseScore 4: Acoustic Bass and the Brush drum kit.
  - Mixed with pedalboard built-in effects (reverb, EQ, compressor).
- Every sound effect (`ui-*`, `tile-*`, `match-stitch`, `cascade`, `shuffle`, `scissor-snip`, `hint-thimble`, `win-sampler`, `lose-thread`): layered in `tools/audio/sfx.py` from hits rendered by `tools/audio/sfx_sheet.py` with Vital `Ceramic` (Databroth pack) and `Easy Mallet`, Serum 2 `PL - Plucked Bottle` and `BL - Kinderjoy`, and the MS Basic Woodblock, combined with numpy-synthesised foley (filtered noise, sine thuds). Each cue mixes at least two sources and is filtered, enveloped and re-levelled, so no preset hit or sample ships on its own.

No third-party sample libraries are used.

## Licence notes

- **Vital** is free software under the GNU GPL v3. The GPL covers the synthesizer, not audio rendered with it; the rendered files here are original works. Third-party Vital preset packs (Yuli Yolo, In The Mix, Databroth) are credited by name; no separate licence file shipped with them locally.
- **Serum 2** factory presets were used as instruments in original compositions, the intended use of a synth's factory sounds.
- **MS Basic SoundFont**: MIT licence (FluidR3 by Frank Wen, FluidR3Mono by Michael Cowgill, MuseScore_General adaptation by S. Christian Collins). The full licence and acknowledgements are in `MS-Basic-soundfont-license.md`.

The earlier CC0 placeholders (CodeManu's "Cozy Puzzle In-Game 1" and Kenney UI Audio) and the 2026 FluidSynth-only waltz are no longer shipped.
