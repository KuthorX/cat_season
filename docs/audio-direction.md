# Cat Season audio direction

## Concept

**A grandmother's sewing box, heard from the armchair next to it.** The art is an
autumn cross-stitch sampler, so the sound is made of the same things: bone
buttons tapped on a walnut table, thread drawn through linen, plucked thread,
small scissors and a brass thimble. The music is the waltz she hums while
stitching.

Three ideas tie the sound to the game:

- **Three.** Match-3 becomes 3/4 time. The waltz has three beats to a bar, and
  its signature "three stitches" motif (three repeated celesta notes and a
  lift) opens every section. The match sound is three quick stitch pulls.
- **One key.** Everything pitched sits in D dorian (D E F G A B C), so a match
  never clashes with the music. The bright raised 6th (B natural) gives the
  autumn mood: wistful, not sad.
- **Dry and close.** SFX have no reverb and are short, as if the sewing box
  were on your lap. Only the music has a little room around it.

## Music

| Track | File | Length | Tempo / metre | Mode | Loudness |
|---|---|---|---|---|---|
| The Sampler Waltz (menu + gameplay, one continuous loop) | `public/assets/audio/sampler-waltz.ogg` (Opus 80 kbps, 1.07 MB) + `.mp3` fallback (96 kbps) | 90.000 s (40 bars) | 80 BPM, 3/4 | D dorian, B section in F major | -18.0 LUFS integrated, -5.1 dBTP |

**Instrumentation** (General MIDI from the MS Basic SoundFont): clarinet
(melody), bassoon (B-section melody), flute (high sustained counter-line),
nylon guitar (the "pah-pah" of the waltz on beats 2 and 3), pizzicato strings
(the "oom" on beat 1), celesta (needle glints and the three-stitch motif),
music box (arpeggios in the last A section) and slow strings (a quiet bed in
the middle 24 bars). No drums: embroidery is quiet.

**Cue sheet** (bar numbers and times from the loop start):

| Bars | Time | Section | What you should hear |
|---|---|---|---|
| 1-4 | 0:00-0:09 | Intro | Guitar and pizz waltz alone, Dm / G. The celesta plays the three-stitch motif (A A A then D up high) in bars 1 and 3. |
| 5-12 | 0:09-0:27 | A | The clarinet takes the tune: a falling A-G-F, then a climb through B natural (the dorian colour). Ends on A7, unresolved. |
| 13-20 | 0:27-0:45 | A' | The clarinet answers and comes home to low D. The strings bed and a high flute (F, A, E, F) come in. |
| 21-28 | 0:45-1:03 | B | Relative major, F. The bassoon sings in the low register while the flute holds long notes above it. Pizz plays root and fifth. The warmest part. |
| 29-36 | 1:03-1:21 | A'' | The clarinet tune returns, with music-box arpeggios twinkling two octaves up. It ends on A minor instead of D. |
| 37-40 | 1:21-1:30 | Coda | The celesta climbs Dm, G, Bb and A7 arpeggios and hands back to bar 1. There is no ending, so the loop is invisible. |

**Seamless loop.** The score is rendered three times in one MIDI file. The
middle pass is cut out sample-exactly (40 bars at 80 BPM = 4,320,000 samples
at 48 kHz), so bar 1 already carries the reverb tail of bar 40. The build
fails if the second and third passes are not bit-identical. Measured on the
decoded Opus file, the step across the seam is 0.0006 against a 99th
percentile sample step of 0.037, so there is no click.

**Loading.** The music never blocks startup. It is fetched after the boot
loader finishes (`GameplayScene.loadMusic`) and starts on the first user
gesture (Web Audio unlock), exactly as before. In game it plays at volume
0.35. The old track was -12 LUFS at 0.18, so the perceived level is about the
same.

## Sound effects

All SFX are mono 48 kHz, peak-normalised to -3 dBFS before encoding, with
true peak at or below -2.3 dBTP after encoding. Each ships as Opus `.ogg`
(0.7-18 KB) plus an `.mp3` fallback and is preloaded, which is about 60 KB of
Opus in total. "Loudness" is integrated LUFS with the file padded to 0.5 s.
The per-call volume in `GameplayScene` evens them out.

| Event | File | Length | Sound | Pitch / timbre | Loudness |
|---|---|---|---|---|---|
| Deselect a tile, arm a power-up | `ui-click` | 0.10 s | A bone sewing button tapped on wood | Wooden modes at 1.85, 2.93 and 4.41 kHz with a 420 Hz body. No pitch. | -26.4 |
| Start, Play again, snack used, power-up earned (+7 semitones) | `ui-confirm` | 0.51 s | A button tap, then a plucked D5 to A5 | A bright pluck, an open fifth upward | -18.9 |
| Hover over a tile | `tile-hover` | 0.11 s | A whisper of thread drawn through cloth | Band-passed noise, 2.5-7 kHz, very soft in game (0.12) | -22.5 |
| Pick a tile | `tile-select` | 0.17 s | A needle piercing the linen, plus a tiny A5 pluck | A high "tk" then a small ring | -28.8 |
| Illegal swap or failed power-up | `ui-invalid` | 0.31 s | Thread snagging: two muted plucks, G3 then F#3, over a soft 110 Hz thud | Low, dull, a falling semitone. Never a buzzer. | -22.6 |
| Accepted match | `match-stitch` | 0.59 s | Three stitch pulls (swish, pluck) climbing D5, F5, A5 | A rising D minor triad, dorian-friendly | -17.4 |
| Each cascade after the first (+1 semitone per extra cascade) | `cascade` | 0.48 s | A faster, brighter run of three stitches, A5, C6, E6 | Higher and brighter than the match | -20.0 |
| Board auto-reshuffle | `shuffle` | 0.49 s | A knock on the embroidery hoop and a rustle of linen | Wooden 240 Hz knock and grainy 0.8-4 kHz rustle | -15.7 |
| Wand (row) / stamp (column) power-up (+80 / -60 cents) | `scissor-snip` | 0.21 s | Small embroidery scissors: two blade snips | Metallic 3.1, 4.9 and 7.3 kHz ring with a sheared noise | -23.2 |
| Hint | `hint-thimble` | 0.31 s | A brass thimble tinked twice | A pure 2.35 kHz tone with inharmonic partials | -16.9 |
| Puzzle won | `win-sampler` | 1.94 s | A music box runs up D5, F5, A5, C6, D6, then rings an A-D-F chord over a plucked D-A-F | Bell-like, warm, resolved | -15.3 |
| Out of moves | `lose-thread` | 1.81 s | A loose thread unravelling: soft plucks falling A4, G4, F4, E4, landing on a low D octave | Muted and gentle: consoling, not mocking | -16.1 |

## Rebuilding

```sh
python3 tools/audio/build.py --report
```

This needs numpy, scipy, fluidsynth and ffmpeg (with libopus and libmp3lame).
It reads the MS Basic SoundFont from the MuseScore 4 install path. The build
is deterministic: fixed seeds for humanisation and noise.

## Licenses

See `public/assets/audio/CREDITS.md`. The music is original and rendered with
the MIT-licensed MS Basic SoundFont (its license is committed alongside). The
SFX are synthesised from scratch. No third-party samples ship.
