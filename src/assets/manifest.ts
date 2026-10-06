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
    music: 'audio-cozy-puzzle-ingame',
    click: 'audio-ui-click',
    invalid: 'audio-ui-invalid',
    match: 'audio-match-pop',
    shuffle: 'audio-shuffle',
    hover: 'audio-tile-hover',
  },
};

/** Paths stay relative so the build works from any folder (itch.io serves games from a subpath). */
export const ASSET_PATHS = {
  board: 'assets/board/board.webp',
  tile: {
    paw: 'assets/tiles/tile-paw.png',
    fish: 'assets/tiles/tile-fish.png',
    yarn: 'assets/tiles/tile-yarn.png',
    bell: 'assets/tiles/tile-bell.png',
    milk: 'assets/tiles/tile-milk.png',
    cushion: 'assets/tiles/tile-cushion.png',
    tuna: 'assets/tiles/tile-tuna.png',
    star: 'assets/tiles/tile-star.png',
  } satisfies Record<TileKind, string>,
  fx: {
    stitch: 'assets/fx/fx-stitch.png',
    thread: 'assets/fx/fx-thread.png',
  },
  audio: {
    music: 'assets/audio/cozy-puzzle-ingame.ogg',
    click: 'assets/audio/ui-click.ogg',
    invalid: 'assets/audio/ui-invalid.ogg',
    match: 'assets/audio/match-pop.ogg',
    shuffle: 'assets/audio/shuffle.ogg',
    hover: 'assets/audio/tile-hover.ogg',
  },
};

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
