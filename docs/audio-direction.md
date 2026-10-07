# Cat Season audio direction

## Concept

**A grandmother's sewing box, heard from the armchair next to it.** The art is an
autumn cross-stitch sampler, so the sound is made of the same things: bone
buttons tapped on a walnut table, thread drawn through linen, plucked thread,
small scissors and a brass thimble. The music is the waltz she hums while
stitching.

Three ideas tie the sound to the game:

- **Three.** Match-3 becomes 3/4 time. The waltz has three beats to a bar, and
  its signature "three stitches" motif (three repeated plucked notes and a
  lift) opens the tune and returns in the coda. The match sound is three quick stitch pulls.
- **One key.** Everything pitched sits in D dorian (D E F G A B C), so a match
  never clashes with the music. The bright raised 6th (B natural) gives the
  autumn mood: wistful, not sad.
- **Dry and close.** SFX have no reverb and are short, as if the sewing box
  were on your lap. Only the music (and the win fanfare) has a little room.

## Music

| Track | File | Length | Tempo / metre | Mode | Loudness |
|---|---|---|---|---|---|
| The Sampler Waltz (menu + gameplay, one continuous loop) | `public/assets/audio/sampler-waltz.ogg` (Opus 80 kbps, 1.3 MB) + `.mp3` fallback (96 kbps) | 96.000 s (48 bars) | 90 BPM, 3/4 | D dorian, B sections in F major | -18.0 LUFS integrated, -6.4 dBTP |

**Instrumentation** (2026 rescore; every part rendered offline, headless, from
synth presets and a GM SoundFont):

| Part | Source | Role |
|---|---|---|
| Melody (A sections, coda) | Serum 2 `KY - Delicacy` | clean, delicate keys: the hummed tune |
| Broken chords (B sections) | Serum 2 `KY - Delicacy` | quiet eighth-note arpeggios under the flute |
| B-section melody | Serum 2 `WIND - Flute` | breathy flute, the warmest part |
| Counter-line (A') | Serum 2 `WIND - Flute` | long notes, far back in the mix |
| Three-stitch motif | Serum 2 `PL - Plucked Bottle` | hollow plucked thread, intro and coda |
| Music-box twinkles (A'') | Serum 2 `BL - Kinderjoy` | very quiet, low-passed at 7 kHz |
| "Pah-pah" on beats 2 and 3 | Vital `Easy Mallet` (Yuli Yolo pack) | felt marimba triads |
| Pad bed (bars 13-44) | Vital `Analog Pad` (In The Mix pack) | warm, dark, high shelf +4 dB so it is heard |
| "Oom" bass on beat 1 | MS Basic GM 32 Acoustic Bass | upright bass, root/fifth walk in B |
| Brushes (bars 21-44) | MS Basic GM brush kit (drum channel, program 40) | soft kick, brush taps, ride |

**Cue sheet** (bar numbers and times from the loop start; one bar = 2 s):

| Bars | Time | Section | What you should hear |
|---|---|---|---|
| 1-4 | 0:00-0:08 | Intro | Bass and mallet waltz alone, Dm / G. The plucked bottle plays the three-stitch motif (A A A then D) in bar 1 and (F F F then A) in bar 3. |
| 5-12 | 0:08-0:24 | A | The keys take the tune, which opens with the motif itself, climbs through B natural (the dorian colour) and ends on A7. |
| 13-20 | 0:24-0:40 | A' | A higher answer that comes home to D. The pad and a quiet flute counter-line enter. |
| 21-28 | 0:40-0:56 | B | F major. The flute sings over keys arpeggios; brushes come in. |
| 29-36 | 0:56-1:12 | B' | The flute climbs to Bb5 and turns back through E half-diminished to A7. |
| 37-44 | 1:12-1:28 | A'' | The keys tune returns with music-box twinkles two octaves up. |
| 45-48 | 1:28-1:36 | Coda | The stitch motif climbs Bb, Gm, Em7b5, A7 and hands back to bar 1. There is no ending, so the loop is invisible. |

**Seamless loop.** 48 bars at 90 BPM is exactly 96 s. The render folds the
reverb and release tail that rings past bar 48 back onto bar 1 (audiokit
`loop`), and the 44.1 to 48 kHz resample runs on three tiled copies with the
middle one kept, so both edges see their true neighbours. Measured on the
decoded Opus file: 4,608,000 samples, step across the seam 0.0095 against a
99th-percentile step of 0.029, so there is no click.

**Loading.** The music never blocks startup. It is fetched after the boot
loader finishes (`GameplayScene.loadMusic`) and starts on the first user
gesture (Web Audio unlock). In game it plays at volume 0.35, the same as
before at the same -18 LUFS.

## Sound effects

All SFX are mono 48 kHz. Each layers at least two sources: a hit cut from the
rendered "source sheet" (`tools/audio/sfx_sheet.py`: Vital `Ceramic`, Serum 2
`PL - Plucked Bottle` and `BL - Kinderjoy`, Vital `Easy Mallet`, MS Basic GM
115 Woodblock) plus another preset hit or numpy foley (band-passed noise for
thread and scissors, a sine thud). Each cue is high-passed at 40 Hz,
normalised to -16 LUFS with the true peak held at or below -1 dBTP by gain only,
then encoded as Opus `.ogg` plus an `.mp3` fallback. Short ticks reach the peak
ceiling first, so they land below -16 LUFS. `AUDIO_TRIM` in
`src/assets/manifest.ts` is the old-minus-new loudness of each file, so the
per-call volumes in `GameplayScene` keep the balance they were tuned for.

| Event | File | Length | Layers | Loudness (LUFS, padded to 0.5 s) |
|---|---|---|---|---|
| Deselect a tile, arm a power-up | `ui-click` | 0.11 s | Woodblock tap + Ceramic tick: a bone button on walnut | -21.2 |
| Start, Play again, snack used, power-up earned (+7 semitones) | `ui-confirm` | 0.51 s | Woodblock tap, bottle plucks D5 then A5, Kinderjoy D5 shimmer | -16.0 |
| Hover over a tile | `tile-hover` | 0.12 s | Noise swish (thread through linen) + a faint Ceramic tick | -20.9 |
| Pick a tile | `tile-select` | 0.18 s | Ceramic needle tick, noise pierce, tiny bottle A5 | -17.9 |
| Illegal swap or failed power-up | `ui-invalid` | 0.33 s | Mallet G2 knock, low-passed bottle G3 then F#3, 110 Hz thud | -15.9 |
| Accepted match | `match-stitch` | 0.67 s | Three swish + bottle pulls D5, F5, A5, Kinderjoy A5 on top | -14.9 |
| Each cascade after the first (+1 semitone per extra cascade) | `cascade` | 0.52 s | Faster swish + bottle A5, C6, E6, Ceramic sparkle | -16.0 |
| Board auto-reshuffle | `shuffle` | 0.49 s | Linen rustle grains + woodblock and mallet hoop knock | -17.5 |
| Wand (row) / stamp (column) power-up (+80 / -60 cents) | `scissor-snip` | 0.22 s | Two blade snips: sheared noise + Ceramic ticks | -20.3 |
| Hint | `hint-thimble` | 0.33 s | Kinderjoy tine + Ceramic tick, tinked twice | -16.0 |
| Puzzle won | `win-sampler` | 1.94 s | Kinderjoy + bottle run D5-F5-A5-C6-D6, then Kinderjoy A-D-F over mallet D-A-F, small room | -16.0 |
| Out of moves | `lose-thread` | 1.81 s | Bottle plucks falling A4-G4-F4-E4 onto D4 with mallet D3/D4, low-passed | -16.0 |

## Rebuilding

```sh
arch -arm64 /tmp/audiokit/venv/bin/python tools/audio/build.py --report
```

Steps: `prepare` (`score.py` and `sfx_sheet.py` write MIDI and two audiokit
render specs into `/tmp/cat_season_audio`), `render` (two `render.py` runs
serialised by `lockf` on `/tmp/audiokit/render.lock`; Vital and Serum 2 are
hosted headless by pedalboard, no window, no playback) and `assemble`
(`sfx.py` layering, music resample, Opus/MP3 encode). Steps can be run alone,
e.g. `build.py assemble`. It needs the audiokit toolchain, the Vital and
Serum 2 factory/pack presets named above, fluidsynth with the MuseScore 4
MS Basic SoundFont, and ffmpeg with libopus and libmp3lame. Seeds are fixed.

## Licenses

See `public/assets/audio/CREDITS.md`. Music and SFX were composed
programmatically by AI (Claude) and rendered with Vital, Serum 2 and the
MIT-licensed MS Basic SoundFont (its license is committed alongside). No
third-party sample libraries are used and no bare preset hit ships on its own.
