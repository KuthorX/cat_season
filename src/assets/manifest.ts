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

export const TILE_LABELS: Record<TileKind, string> = {
  paw: '猫爪',
  fish: '小鱼',
  yarn: '毛线',
  bell: '铃铛',
  milk: '猫奶',
  cushion: '软垫',
  tuna: '金枪鱼',
  star: '星星',
};

export const POWER_UP_LABELS = {
  snack: '猫薄荷',
  wand: '逗猫棒',
  stamp: '爪印章',
} as const;

export const POWER_UP_DESCRIPTIONS = {
  snack: '增加 5 步',
  wand: '清除一整行',
  stamp: '清除一整列',
} as const;
