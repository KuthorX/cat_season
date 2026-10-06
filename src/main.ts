import Phaser from 'phaser';
import './styles.css';
import { applyDocumentLocale } from './i18n';
import { GAME_SIZE } from './scenes/boardLayout';
import { GameplayScene } from './scenes/GameplayScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_SIZE,
  height: GAME_SIZE,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
  },
  scene: [GameplayScene],
};

applyDocumentLocale();
new Phaser.Game(config);
