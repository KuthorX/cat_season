import type { TileKind } from '../systems/catPuzzle';

export const ASSET_KEYS = {
  board: 'cat-season-board',
  tile: {
    paw: 'tile-paw',
    fish: 'tile-fish',
    yarn: 'tile-yarn',
    bell: 'tile-bell',
    milk: 'tile-milk',
    cushion: 'tile-cushion',
    tuna: 'tile-tuna',
    star: 'tile-star',
  } satisfies Record<TileKind, string>,
  fx: {
    stitch: 'fx-stitch',
    thread: 'fx-thread',
  },
  audio: {
    music: 'audio-sampler-waltz',
    click: 'audio-ui-click',
    confirm: 'audio-ui-confirm',
    hover: 'audio-tile-hover',
    select: 'audio-tile-select',
    invalid: 'audio-ui-invalid',
    match: 'audio-match-stitch',
    cascade: 'audio-cascade',
    shuffle: 'audio-shuffle',
    snip: 'audio-scissor-snip',
    hint: 'audio-hint-thimble',
    win: 'audio-win-sampler',
    lose: 'audio-lose-thread',
  },
};

/** Paths stay relative so the build works from any folder (itch.io serves games from a subpath). */
export const ASSET_PATHS = {
  board: 'assets/board/board.webp',
  tile: {
    paw: 'assets/tiles/tile-paw.webp',
    fish: 'assets/tiles/tile-fish.webp',
    yarn: 'assets/tiles/tile-yarn.webp',
    bell: 'assets/tiles/tile-bell.webp',
    milk: 'assets/tiles/tile-milk.webp',
    cushion: 'assets/tiles/tile-cushion.webp',
    tuna: 'assets/tiles/tile-tuna.webp',
    star: 'assets/tiles/tile-star.webp',
  } satisfies Record<TileKind, string>,
  fx: {
    stitch: 'assets/fx/fx-stitch.png',
    thread: 'assets/fx/fx-thread.png',
  },
  /** Each audio entry is a base path: `.ogg` (Opus) first, `.mp3` as the fallback. Built by tools/audio/build.py. */
  audio: {
    music: 'assets/audio/sampler-waltz',
    click: 'assets/audio/ui-click',
    confirm: 'assets/audio/ui-confirm',
    hover: 'assets/audio/tile-hover',
    select: 'assets/audio/tile-select',
    invalid: 'assets/audio/ui-invalid',
    match: 'assets/audio/match-stitch',
    cascade: 'assets/audio/cascade',
    shuffle: 'assets/audio/shuffle',
    snip: 'assets/audio/scissor-snip',
    hint: 'assets/audio/hint-thimble',
    win: 'assets/audio/win-sampler',
    lose: 'assets/audio/lose-thread',
  } satisfies Record<AudioCue, string>,
};

export type AudioCue = keyof typeof ASSET_KEYS.audio;

/** Opus is smaller and loops sample-exact; MP3 covers browsers that cannot decode Ogg. */
export function audioSources(cue: AudioCue): Phaser.Types.Loader.FileTypes.AudioFileURLConfig[] {
  const base = ASSET_PATHS.audio[cue];
  return [
    { type: 'opus', url: `${base}.ogg` },
    { type: 'mp3', url: `${base}.mp3` },
  ];
}

/** Thread colours, matching the main colour of each motif in tools/art/generate.py. */
export const THREAD = {
  tile: {
    paw: 0xc65a30,
    fish: 0x3f739c,
    yarn: 0xd27b93,
    bell: 0xd9a93c,
    milk: 0x2f6b5a,
    cushion: 0x8fb07f,
    tuna: 0x7d4f86,
    star: 0x2e8f8a,
  } satisfies Record<TileKind, number>,
  madder: 0xa53f26,
  straw: 0xc99a2a,
  spruce: 0x2f5a4a,
  ink: 0x33241a,
};
