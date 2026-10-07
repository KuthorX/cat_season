# Audio Credits

All audio in this folder is original to Cat Season and is rebuilt by
`python3 tools/audio/build.py` (see `docs/audio-direction.md`).

- `sampler-waltz.ogg` / `.mp3`: "The Sampler Waltz", composed in code (`tools/audio/score.py`) and rendered offline with FluidSynth using the **MS Basic** SoundFont shipped with MuseScore 4 (MIT license; FluidR3 by Frank Wen, FluidR3Mono by Michael Cowgill, MuseScore_General adaptation by S. Christian Collins). The full license and acknowledgements are in `MS-Basic-soundfont-license.md`.
- Every sound effect (`ui-*`, `tile-*`, `match-stitch`, `cascade`, `shuffle`, `scissor-snip`, `hint-thimble`, `win-sampler`, `lose-thread`): synthesised from scratch with numpy/scipy in `tools/audio/sfx.py`. No samples are used.

The earlier CC0 placeholders (CodeManu's "Cozy Puzzle In-Game 1" and Kenney UI Audio) are no longer shipped.
