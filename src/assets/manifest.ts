import type { TileKind } from '../systems/catPuzzle';

export const ASSET_KEYS = {
  background: 'cat-season-bg',
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
    pawParticle: 'fx-paw-particle',
    sparkleParticle: 'fx-sparkle-particle',
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

export const ASSET_PATHS = {
  background: 'assets/environment/cat-season-bg.png',
  tile: {
    paw: 'assets/tiles/tile-paw.svg',
    fish: 'assets/tiles/tile-fish.svg',
    yarn: 'assets/tiles/tile-yarn.svg',
    bell: 'assets/tiles/tile-bell.svg',
    milk: 'assets/tiles/tile-milk.svg',
    cushion: 'assets/tiles/tile-cushion.svg',
    tuna: 'assets/tiles/tile-tuna.svg',
    star: 'assets/tiles/tile-star.svg',
  } satisfies Record<TileKind, string>,
  fx: {
    pawParticle: 'assets/fx/fx-paw-particle.svg',
    sparkleParticle: 'assets/fx/fx-sparkle-particle.svg',
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
