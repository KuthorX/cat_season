import Phaser from 'phaser';
import './styles.css';
import { GameplayScene } from './scenes/GameplayScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 960,
  height: 640,
  backgroundColor: '#122227',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [GameplayScene],
};

new Phaser.Game(config);
