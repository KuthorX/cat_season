import Phaser from 'phaser';
import './styles.css';
import { applyDocumentLocale } from './i18n';
import { GAME_SIZE } from './scenes/boardLayout';
import { GameplayScene } from './scenes/GameplayScene';
import { mountStageFit } from './ui/fitStage';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_SIZE,
  height: GAME_SIZE,
  transparent: true,
  // The stage CSS scales the canvas with everything else; Phaser reads the scaled bounds for input.
  scale: {
    mode: Phaser.Scale.NONE,
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

window.CatBoot?.report('scripts', 1);
applyDocumentLocale();
let game: Phaser.Game | undefined;
const stage = document.getElementById('app');
if (stage) {
  mountStageFit(stage, () => game?.scale.refresh());
}
game = new Phaser.Game(config);
