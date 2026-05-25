import Phaser from 'phaser';
import { ASSET_KEYS, ASSET_PATHS } from '../assets/manifest';
import {
  TILE_KINDS,
  applyMove,
  createPuzzle,
  findSuggestedMove,
  usePowerUp,
  type Board,
  type GridPoint,
  type Match,
  type PowerUpKind,
  type PuzzleState,
  type ShuffleMove,
  type TileDrop,
  type TileKind,
} from '../systems/catPuzzle';
import { HudController } from '../ui/hud';

const BOARD_SIZE = 7;
const TILE_SIZE = 112;
const TILE_GAP = 12;
const BOARD_PADDING = 28;
const BOARD_X = 292;
const BOARD_Y = 56;
const TILE_TEXTURE_SIZE = 256;
const TILE_ICON_SIZE = 78;

type TileView = {
  container: Phaser.GameObjects.Container;
  content: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  bg: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Image;
  kind: TileKind;
  scaleTween?: Phaser.Tweens.Tween;
  invalidTween?: Phaser.Tweens.Tween;
};

export class GameplayScene extends Phaser.Scene {
  private state!: PuzzleState;
  private hud?: HudController;
  private selected?: GridPoint;
  private tileViews = new Map<string, TileView>();
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private hintGraphics?: Phaser.GameObjects.Graphics;
  private boardFrame?: Phaser.GameObjects.Container;
  private boardLayer?: Phaser.GameObjects.Container;
  private boardInputZone?: Phaser.GameObjects.Zone;
  private pendingPowerUp?: PowerUpKind;
  private inputLocked = false;
  private hovered?: GridPoint;
  private lastBoardSignature?: string;
  private music?: Phaser.Sound.BaseSound;
  private audioStarted = false;
  private menuRoot?: HTMLElement;
  private startButton?: HTMLButtonElement;

  constructor() {
    super('gameplay');
  }

  preload(): void {
    this.load.image(ASSET_KEYS.background, ASSET_PATHS.background);
    for (const kind of TILE_KINDS) {
      this.load.svg(ASSET_KEYS.tile[kind], ASSET_PATHS.tile[kind], { width: TILE_TEXTURE_SIZE, height: TILE_TEXTURE_SIZE });
    }
    this.load.svg(ASSET_KEYS.fx.pawParticle, ASSET_PATHS.fx.pawParticle, { width: 96, height: 96 });
    this.load.svg(ASSET_KEYS.fx.sparkleParticle, ASSET_PATHS.fx.sparkleParticle, { width: 96, height: 96 });
    this.load.audio(ASSET_KEYS.audio.music, ASSET_PATHS.audio.music);
    this.load.audio(ASSET_KEYS.audio.click, ASSET_PATHS.audio.click);
    this.load.audio(ASSET_KEYS.audio.invalid, ASSET_PATHS.audio.invalid);
    this.load.audio(ASSET_KEYS.audio.match, ASSET_PATHS.audio.match);
    this.load.audio(ASSET_KEYS.audio.shuffle, ASSET_PATHS.audio.shuffle);
    this.load.audio(ASSET_KEYS.audio.hover, ASSET_PATHS.audio.hover);
  }

  create(): void {
    this.cameras.main.setRoundPixels(false);
    this.createHud();
    this.setupAudio();
    this.showStartMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupGameState({ destroyHud: true, removeDocumentListeners: true }));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupGameState({ destroyHud: true, removeDocumentListeners: true }));
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private startNewPuzzle = (): void => {
    this.hideStartMenu();
    this.cleanupGameState({ keepHud: true });
    this.state = this.createRandomPuzzle();
    this.lastBoardSignature = this.boardSignature(this.state.board);

    this.createBoardFrame();
    this.boardLayer = this.add.container(0, 0).setDepth(10);
    this.createBoardInputZone();
    this.renderBoard();
    this.animateBoardArrival(undefined, this.state.board, { intro: true });
    this.updateHud();
  };

  private createRandomPuzzle(): PuzzleState {
    let puzzle: PuzzleState | undefined;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      puzzle = createPuzzle({
        seed: this.randomSeed(),
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        moves: 24,
        mode: 'endless',
        inventory: {
          snack: 1,
          wand: 1,
          stamp: 1,
        },
        goals: {
          paw: 8,
          fish: 8,
          yarn: 7,
          bell: 6,
        },
      });

      if (this.boardSignature(puzzle.board) !== this.lastBoardSignature) {
        return puzzle;
      }
    }

    return puzzle ?? createPuzzle({
      seed: this.randomSeed(),
      width: BOARD_SIZE,
      height: BOARD_SIZE,
      moves: 24,
      mode: 'endless',
      inventory: {
        snack: 1,
        wand: 1,
        stamp: 1,
      },
      goals: {
        paw: 8,
        fish: 8,
        yarn: 7,
        bell: 6,
      },
    });
  }

  private randomSeed(): number {
    const values = new Uint32Array(1);
    globalThis.crypto?.getRandomValues(values);
    return values[0] || ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  }

  private boardSignature(board: PuzzleState['board']): string {
    return board.map((row) => row.join('|')).join('/');
  }

  private createBoardFrame(): void {
    this.boardFrame?.destroy(true);
    const width = BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP + BOARD_PADDING * 2;
    const height = width;
    const x = BOARD_X + width / 2 - BOARD_PADDING;
    const y = BOARD_Y + height / 2 - BOARD_PADDING;

    this.boardFrame = this.add.container(0, 0).setDepth(1);
    const shadow = this.add.rectangle(x + 14, y + 18, width, height, 0x102229, 0.34);
    const panel = this.add.rectangle(x, y, width, height, 0xfff4df, 0.82);
    const inner = this.add.rectangle(x, y, width - 18, height - 18, 0xfffbf1, 0.28);
    panel.setStrokeStyle(5, 0xfff0c7, 0.78);
    inner.setStrokeStyle(2, 0x2d7777, 0.2);

    this.boardFrame.add([shadow, panel, inner]);
  }

  private createHud(): void {
    const root = document.getElementById('hud-root');
    if (!root) {
      throw new Error('Missing #hud-root');
    }

    this.hud = new HudController(root, {
      onNewGame: this.startNewPuzzle,
      onHint: this.showHint,
      onPowerUp: this.selectPowerUp,
    });
    this.hud.mount();
    root.hidden = true;
  }

  private showStartMenu(): void {
    const root = document.getElementById('menu-root');
    if (!root) {
      throw new Error('Missing #menu-root');
    }

    this.menuRoot = root;
    document.getElementById('app')?.classList.add('is-menu-open');
    root.hidden = false;
    root.innerHTML = `
      <div class="menu-content">
        <p class="menu-kicker">秋日猫咪消消乐</p>
        <h1>猫咪季节</h1>
        <p class="menu-copy">整理猫爪、小鱼和毛线，把窗边的小物一件件收好。</p>
        <button class="menu-start" type="button">开始游戏</button>
      </div>
    `;

    this.startButton = root.querySelector<HTMLButtonElement>('.menu-start') ?? undefined;
    this.startButton?.addEventListener('click', this.handleStartClick);
  }

  private hideStartMenu(): void {
    this.startButton?.removeEventListener('click', this.handleStartClick);
    this.startButton = undefined;
    if (this.menuRoot) {
      this.menuRoot.hidden = true;
      this.menuRoot.innerHTML = '';
    }
    document.getElementById('app')?.classList.remove('is-menu-open');

    const hudRoot = document.getElementById('hud-root');
    if (hudRoot) {
      hudRoot.hidden = false;
    }
  }

  private handleStartClick = (): void => {
    this.ensureAudioStarted();
    this.playSound(ASSET_KEYS.audio.click, { volume: 0.42 });
    this.startNewPuzzle();
  };

  private setupAudio(): void {
    this.music = this.sound.add(ASSET_KEYS.audio.music, {
      loop: true,
      volume: 0.18,
    });

    if (!this.sound.locked) {
      this.ensureAudioStarted();
      return;
    }

    this.sound.once(Phaser.Sound.Events.UNLOCKED, this.ensureAudioStarted);
  }

  private ensureAudioStarted = (): void => {
    if (this.audioStarted || !this.music) {
      return;
    }

    this.audioStarted = this.music.isPlaying || this.music.play();
  };

  private playSound(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.audioStarted || this.sound.mute) {
      return;
    }

    this.sound.play(key, config);
  }

  private renderBoard(board: Board = this.state.board): void {
    this.tileViews.forEach((view) => view.container.destroy(true));
    this.tileViews.clear();

    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        this.createTileView({ x, y }, board[y][x]);
      }
    }
  }

  private createTileView(point: GridPoint, kind: TileKind): void {
    const { x, y } = this.cellToWorld(point);
    const container = this.add.container(x, y).setSize(TILE_SIZE, TILE_SIZE);
    const content = this.add.container(0, 0).setSize(TILE_SIZE, TILE_SIZE);
    const shadow = this.add.ellipse(3, 8, TILE_SIZE * 0.86, TILE_SIZE * 0.72, 0x153238, 0.16);
    const bg = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xfff8e8, 0.98);
    const sprite = this.add.image(0, 0, ASSET_KEYS.tile[kind]).setDisplaySize(TILE_ICON_SIZE, TILE_ICON_SIZE);

    bg.setStrokeStyle(2, 0x2f5861, 0.2);
    content.add([shadow, bg, sprite]);
    container.add(content);
    this.boardLayer?.add(container);
    this.tileViews.set(this.key(point), { container, content, shadow, bg, sprite, kind });
  }

  private createBoardInputZone(): void {
    const boardPixels = BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP;
    this.boardInputZone = this.add
      .zone(
        BOARD_X + boardPixels / 2,
        BOARD_Y + boardPixels / 2,
        boardPixels + TILE_GAP,
        boardPixels + TILE_GAP,
      )
      .setDepth(40)
      .setInteractive();
    this.boardInputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const point = this.pointerToCell(pointer);
      if (point) {
        this.handleBoardPointer(point, pointer.id);
      }
    });
    this.boardInputZone.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.setHovered(this.pointerToCell(pointer));
    });
    this.boardInputZone.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.setHovered(undefined);
    });
  }

  private handleBoardPointer(point: GridPoint, pointerId: number): void {
    if (this.inputLocked || this.state.status !== 'playing') {
      return;
    }

    this.ensureAudioStarted();
    this.clearHint();
    if (this.pendingPowerUp) {
      this.applyPowerUp(this.pendingPowerUp, point);
      return;
    }

    const selected = this.selected;
    if (!selected) {
      this.playSound(ASSET_KEYS.audio.click, { volume: 0.38 });
      this.setSelected(point);
      return;
    }

    if (this.pointsEqual(selected, point)) {
      this.playSound(ASSET_KEYS.audio.click, { volume: 0.3 });
      this.setSelected(undefined);
      return;
    }

    const boardBeforeMove = this.cloneBoard(this.state.board);
    const boardAfterSwap = this.boardAfterSwap(boardBeforeMove, selected, point);
    const result = applyMove(this.state, selected, point);
    if (!result.accepted) {
      this.playSound(ASSET_KEYS.audio.invalid, { volume: 0.42 });
      this.setSelected(point);
      this.signalInvalid(point, pointerId);
      return;
    }

    this.inputLocked = true;
    this.state = result.state;
    this.setSelected(undefined);
    this.setHovered(undefined);
    this.playSound(ASSET_KEYS.audio.match, { volume: 0.46 });
    this.animateAcceptedMove(selected, point, result.initialMatches);
    const timer = this.time.delayedCall(720, () => {
      const targetBoard = result.boardBeforeRepair ?? result.state.board;
      this.renderBoard(targetBoard);
      this.animateTileDrops(result.drops, targetBoard, boardAfterSwap);
      this.finishBoardUpdate({
        boardBeforeRepair: result.boardBeforeRepair,
        finalState: result.state,
        shuffleMoves: result.shuffleMoves,
        drops: [],
        delay: result.boardBeforeRepair ? 540 : 460,
      });
    });
    this.activeTimers.push(timer);
  }

  private animateAcceptedMove(from: GridPoint, to: GridPoint, matches: Match[]): void {
    this.animateSwap(from, to);

    for (const [key, kind] of this.matchedKindByCell(matches)) {
      const point = this.parseKey(key);
      const view = this.viewAtPostSwapCell(point, from, to);
      if (!view) {
        continue;
      }
      const { x, y } = this.cellToWorld(point);
      this.tweens.add({
        targets: view.container,
        scale: { from: 1, to: 1.28 },
        angle: { from: 0, to: Phaser.Math.Between(-8, 8) },
        duration: 150,
        delay: 170,
        ease: 'Back.easeOut',
        yoyo: true,
      });
      this.tweens.add({
        targets: view.container,
        alpha: 0,
        duration: 260,
        delay: 380,
        ease: 'Sine.easeIn',
      });
      const particleTimer = this.time.delayedCall(330, () => this.burstParticles(x, y, kind));
      this.activeTimers.push(particleTimer);
    }
    const shakeTimer = this.time.delayedCall(360, () => this.cameras.main.shake(130, 0.003));
    this.activeTimers.push(shakeTimer);
  }

  private animateClearCells(cells: GridPoint[]): void {
    const seen = new Set<string>();
    for (const cell of cells) {
      const key = this.key(cell);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const view = this.tileViews.get(key);
      if (!view) {
        continue;
      }
      this.tweens.add({
        targets: view.container,
        scale: { from: 1, to: 1.2 },
        duration: 140,
        ease: 'Back.easeOut',
        yoyo: true,
      });
      this.tweens.add({
        targets: view.container,
        alpha: 0,
        duration: 240,
        delay: 220,
        ease: 'Sine.easeIn',
      });
      const particleTimer = this.time.delayedCall(180, () => this.burstParticles(view.container.x, view.container.y, view.kind));
      this.activeTimers.push(particleTimer);
    }
    const shakeTimer = this.time.delayedCall(220, () => this.cameras.main.shake(110, 0.0025));
    this.activeTimers.push(shakeTimer);
  }

  private animateSwap(from: GridPoint, to: GridPoint): void {
    const fromView = this.tileViews.get(this.key(from));
    const toView = this.tileViews.get(this.key(to));
    if (!fromView || !toView) {
      return;
    }

    const fromWorld = this.cellToWorld(from);
    const toWorld = this.cellToWorld(to);
    this.tweens.add({ targets: fromView.container, x: toWorld.x, y: toWorld.y, duration: 170, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: toView.container, x: fromWorld.x, y: fromWorld.y, duration: 170, ease: 'Sine.easeInOut' });
  }

  private burstParticles(x: number, y: number, kind: TileKind): void {
    const ring = this.add.circle(x, y, 12, 0xffefbd, 0.42).setDepth(34);
    this.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const textures = [ASSET_KEYS.tile[kind], ASSET_KEYS.fx.sparkleParticle, ASSET_KEYS.fx.pawParticle];
    for (let index = 0; index < 16; index += 1) {
      const particle = this.add.image(x, y, textures[index % textures.length]).setDepth(35);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(26, 68);
      particle.setScale(Phaser.Math.FloatBetween(0.16, 0.34));
      particle.setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - Phaser.Math.Between(4, 16),
        scale: 0,
        alpha: 0,
        angle: particle.angle + Phaser.Math.Between(-80, 80),
        duration: Phaser.Math.Between(420, 680),
        ease: 'Back.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private signalInvalid(point: GridPoint, pointerId: number): void {
    const view = this.tileViews.get(this.key(point));
    if (!view) {
      return;
    }

    view.invalidTween?.stop();
    view.content.x = 0;
    view.invalidTween = this.tweens.add({
      targets: view.content,
      x: pointerId % 2 === 0 ? 6 : -6,
      yoyo: true,
      repeat: 2,
      duration: 42,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        view.content.x = 0;
        view.invalidTween = undefined;
      },
      onStop: () => {
        view.content.x = 0;
        view.invalidTween = undefined;
      },
    });
  }

  private matchedKindByCell(matches: Match[]): Map<string, TileKind> {
    const kinds = new Map<string, TileKind>();
    for (const match of matches) {
      for (const cell of match.cells) {
        kinds.set(this.key(cell), match.kind);
      }
    }
    return kinds;
  }

  private viewAtPostSwapCell(point: GridPoint, from: GridPoint, to: GridPoint): TileView | undefined {
    if (this.pointsEqual(point, from)) {
      return this.tileViews.get(this.key(to));
    }
    if (this.pointsEqual(point, to)) {
      return this.tileViews.get(this.key(from));
    }
    return this.tileViews.get(this.key(point));
  }

  private setSelected(point: GridPoint | undefined): void {
    const previousPoint = this.selected;
    if (this.selected) {
      this.syncTileVisual(this.selected);
    }

    this.selected = point;
    if (point) {
      this.syncTileVisual(point);
    }
    if (previousPoint && !this.pointsEqual(previousPoint, point)) {
      this.syncTileVisual(previousPoint);
    }
  }

  private setHovered(point: GridPoint | undefined): void {
    if ((this.inputLocked && point) || this.pointsEqual(this.hovered, point)) {
      return;
    }

    const previous = this.hovered;
    this.hovered = point;
    if (previous) {
      this.syncTileVisual(previous);
    }
    if (point) {
      this.playSound(ASSET_KEYS.audio.hover, { volume: 0.12 });
      this.syncTileVisual(point);
    }
  }

  private syncTileVisual(point: GridPoint): void {
    const view = this.tileViews.get(this.key(point));
    if (!view) {
      return;
    }

    const isSelected = this.pointsEqual(this.selected, point);
    const isHovered = this.pointsEqual(this.hovered, point);
    const targetScale = isSelected ? 1.08 : isHovered ? 1.045 : 1;
    const strokeColor = isSelected ? 0xf2a64b : isHovered ? 0x20b7b3 : 0x2f5861;
    const strokeAlpha = isSelected ? 0.95 : isHovered ? 0.72 : 0.2;
    const strokeWidth = isSelected ? 4 : isHovered ? 3 : 2;

    view.bg.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    view.scaleTween?.stop();
    view.content.x = view.invalidTween ? view.content.x : 0;
    view.scaleTween = this.tweens.add({
      targets: view.content,
      scale: targetScale,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        view.scaleTween = undefined;
      },
      onStop: () => {
        view.scaleTween = undefined;
      },
    });
  }

  private showHint = (): void => {
    if (this.state.status !== 'playing') {
      return;
    }

    this.ensureAudioStarted();
    this.playSound(ASSET_KEYS.audio.click, { volume: 0.28 });
    this.clearHint();
    const hint = findSuggestedMove(this.state);
    if (!hint) {
      return;
    }

    this.hintGraphics = this.add.graphics().setDepth(30);
    this.drawHintCell(hint.from);
    this.drawHintCell(hint.to);
    const timer = this.time.delayedCall(1600, this.clearHint);
    this.activeTimers.push(timer);
  };

  private selectPowerUp = (kind: PowerUpKind): void => {
    if (this.inputLocked || this.state.status !== 'playing') {
      return;
    }

    this.ensureAudioStarted();
    this.playSound(ASSET_KEYS.audio.click, { volume: 0.36 });
    if (kind === 'snack') {
      const result = usePowerUp(this.state, kind);
      if (result.accepted) {
        this.state = result.state;
        if (result.boardBeforeRepair) {
          this.renderBoard(result.boardBeforeRepair);
          this.finishBoardUpdate({
            boardBeforeRepair: result.boardBeforeRepair,
            finalState: result.state,
            shuffleMoves: result.shuffleMoves,
            drops: [],
            delay: 120,
          });
          return;
        }
        this.updateHud();
      }
      return;
    }

    this.pendingPowerUp = this.pendingPowerUp === kind ? undefined : kind;
    this.clearHint();
    if (this.pendingPowerUp) {
      this.showBoardTargetPrompt(kind);
    }
  };

  private applyPowerUp(kind: PowerUpKind, point: GridPoint): void {
    const boardBeforePowerUp = this.cloneBoard(this.state.board);
    const result = usePowerUp(this.state, kind, point);
    this.pendingPowerUp = undefined;
    if (!result.accepted) {
      this.playSound(ASSET_KEYS.audio.invalid, { volume: 0.42 });
      this.signalInvalid(point, 1);
      this.updateHud();
      return;
    }

    this.inputLocked = true;
    this.state = result.state;
    this.setSelected(undefined);
    this.setHovered(undefined);
    this.playSound(ASSET_KEYS.audio.match, { volume: 0.46, detune: kind === 'wand' ? 80 : -60 });
    this.animateClearCells(result.affectedCells);
    const timer = this.time.delayedCall(520, () => {
      const targetBoard = result.boardBeforeRepair ?? result.state.board;
      this.renderBoard(targetBoard);
      this.animateTileDrops(result.drops, targetBoard, boardBeforePowerUp);
      this.finishBoardUpdate({
        boardBeforeRepair: result.boardBeforeRepair,
        finalState: result.state,
        shuffleMoves: result.shuffleMoves,
        drops: [],
        delay: result.boardBeforeRepair ? 520 : 430,
      });
    });
    this.activeTimers.push(timer);
  }

  private finishBoardUpdate(options: {
    boardBeforeRepair?: Board;
    finalState: PuzzleState;
    shuffleMoves: ShuffleMove[];
    drops: TileDrop[];
    delay: number;
  }): void {
    const timer = this.time.delayedCall(options.delay, () => {
      if (options.boardBeforeRepair && options.shuffleMoves.length > 0) {
        this.animateShuffleRepair(options.boardBeforeRepair, options.finalState, options.shuffleMoves, () => {
          this.updateHud();
          this.inputLocked = false;
        });
        return;
      }

      if (options.boardBeforeRepair) {
        this.renderBoard(options.finalState.board);
        this.animateTileDrops(options.drops, options.finalState.board, options.boardBeforeRepair);
      }
      this.updateHud();
      this.inputLocked = false;
    });
    this.activeTimers.push(timer);
  }

  private animateBoardArrival(
    sourceBoard: Board | undefined,
    targetBoard: Board,
    options: { intro?: boolean } = {},
  ): void {
    for (let y = 0; y < targetBoard.length; y += 1) {
      for (let x = 0; x < (targetBoard[y]?.length ?? 0); x += 1) {
        const point = { x, y };
        const view = this.tileViews.get(this.key(point));
        if (!view) {
          continue;
        }

        const target = this.cellToWorld(point);
        const sourceWorld = sourceBoard
          ? { x: target.x, y: target.y - 18 }
          : {
              x: target.x + (options.intro ? Phaser.Math.Between(-10, 10) : 0),
              y: options.intro ? target.y - Phaser.Math.Between(64, 130) : target.y - 24,
            };

        view.container.setPosition(sourceWorld.x, sourceWorld.y);
        view.container.setAlpha(0.58);
        view.container.setScale(0.78);
        view.container.setAngle(0);
        this.tweens.add({
          targets: view.container,
          x: target.x,
          y: target.y,
          alpha: 1,
          scale: 1,
          angle: 0,
          duration: 360,
          delay: y * 20 + x * 4,
          ease: 'Back.easeOut',
        });
      }
    }
  }

  private animateTileDrops(drops: TileDrop[], targetBoard: Board, sourceBoard: Board): void {
    if (drops.length === 0) {
      return;
    }

    const latestDropByTarget = new Map<string, TileDrop>();
    for (const drop of drops) {
      latestDropByTarget.set(this.key(drop.to), drop);
    }

    for (const drop of latestDropByTarget.values()) {
      const view = this.tileViews.get(this.key(drop.to));
      if (!view || targetBoard[drop.to.y]?.[drop.to.x] !== drop.kind) {
        continue;
      }

      const target = this.cellToWorld(drop.to);
      const source = drop.from && sourceBoard[drop.from.y]?.[drop.from.x] === drop.kind
        ? this.cellToWorld(drop.from)
        : { x: target.x, y: BOARD_Y - TILE_SIZE * 0.7 };
      const distance = Math.abs(source.y - target.y);

      view.container.setPosition(source.x, source.y);
      view.container.setAlpha(drop.from ? 0.98 : 0.42);
      view.container.setScale(drop.from ? 0.98 : 0.84);
      view.container.setAngle(drop.from ? 0 : Phaser.Math.Between(-3, 3));
      this.tweens.add({
        targets: view.container,
        x: target.x,
        y: target.y,
        alpha: 1,
        scale: 1,
        angle: 0,
        duration: Phaser.Math.Clamp(180 + distance * 1.15, 240, 420),
        delay: drop.to.y * 14 + drop.to.x * 3,
        ease: drop.from ? 'Cubic.easeOut' : 'Back.easeOut',
      });
    }
  }

  private animateShuffleRepair(
    boardBeforeRepair: Board,
    finalState: PuzzleState,
    shuffleMoves: ShuffleMove[],
    onComplete: () => void,
  ): void {
    this.renderBoard(boardBeforeRepair);
    this.cameras.main.shake(130, 0.002);
    this.playSound(ASSET_KEYS.audio.shuffle, { volume: 0.36 });

    if (shuffleMoves.length === 0) {
      this.renderBoard(finalState.board);
      onComplete();
      return;
    }

    let remaining = shuffleMoves.length;
    for (const move of shuffleMoves) {
      const view = this.tileViews.get(this.key(move.from));
      if (!view) {
        remaining -= 1;
        continue;
      }

      const target = this.cellToWorld(move.to);
      view.container.setDepth(24);
      this.tweens.add({
        targets: view.container,
        x: target.x,
        y: target.y,
        scale: { from: 1, to: 1.07 },
        angle: Phaser.Math.Between(-7, 7),
        duration: 520,
        delay: Phaser.Math.Between(0, 120),
        ease: 'Cubic.easeInOut',
        onComplete: () => {
          remaining -= 1;
          if (remaining === 0) {
            this.renderBoard(finalState.board);
            onComplete();
          }
        },
      });
    }

  }

  private showBoardTargetPrompt(kind: PowerUpKind): void {
    this.hintGraphics = this.add.graphics().setDepth(30);
    this.hintGraphics.lineStyle(4, kind === 'wand' ? 0xffb15a : 0x20b7b3, 0.9);
    const boardPixels = BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP;
    this.hintGraphics.strokeRoundedRect(
      BOARD_X - 4,
      BOARD_Y - 4,
      boardPixels + 8,
      boardPixels + 8,
      14,
    );
  }

  private drawHintCell(point: GridPoint): void {
    if (!this.hintGraphics) {
      return;
    }

    const { x, y } = this.cellToWorld(point);
    this.hintGraphics.lineStyle(5, 0x20b7b3, 0.95);
    this.hintGraphics.strokeRoundedRect(x - TILE_SIZE / 2 + 4, y - TILE_SIZE / 2 + 4, TILE_SIZE - 8, TILE_SIZE - 8, 10);
  }

  private clearHint = (): void => {
    this.hintGraphics?.destroy();
    this.hintGraphics = undefined;
  };

  private updateHud(): void {
    this.hud?.update(this.state);
  }

  private cleanupGameState(opts: { keepHud?: boolean; destroyHud?: boolean; removeDocumentListeners?: boolean } = {}): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers = [];
    this.clearHint();
    this.setSelected(undefined);
    this.hideStartMenu();
    this.tileViews.forEach((view) => view.container.destroy(true));
    this.tileViews.clear();
    this.boardInputZone?.destroy();
    this.boardInputZone = undefined;
    this.boardFrame?.destroy(true);
    this.boardFrame = undefined;
    this.boardLayer?.destroy(true);
    this.boardLayer = undefined;
    this.pendingPowerUp = undefined;
    this.inputLocked = false;
    this.hovered = undefined;

    if (opts.destroyHud || !opts.keepHud) {
      this.hud?.destroy();
      this.hud = undefined;
      this.music?.destroy();
      this.music = undefined;
      this.audioStarted = false;
    }

    if (opts.removeDocumentListeners) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.sound.off(Phaser.Sound.Events.UNLOCKED, this.ensureAudioStarted);
    }
  }

  private handleVisibilityChange = (): void => {
    this.time.paused = document.hidden;
    this.sound.mute = document.hidden;
  };

  private cellToWorld(point: GridPoint): GridPoint {
    return {
      x: BOARD_X + TILE_SIZE / 2 + point.x * (TILE_SIZE + TILE_GAP),
      y: BOARD_Y + TILE_SIZE / 2 + point.y * (TILE_SIZE + TILE_GAP),
    };
  }

  private pointerToCell(pointer: Phaser.Input.Pointer): GridPoint | undefined {
    const localX = pointer.worldX - BOARD_X;
    const localY = pointer.worldY - BOARD_Y;
    const boardPixels = BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP;
    if (localX < 0 || localY < 0 || localX >= boardPixels || localY >= boardPixels) {
      return undefined;
    }

    const stride = TILE_SIZE + TILE_GAP;
    const x = Math.floor(localX / stride);
    const y = Math.floor(localY / stride);
    if (localX % stride >= TILE_SIZE || localY % stride >= TILE_SIZE) {
      return undefined;
    }

    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
      return undefined;
    }

    return { x, y };
  }

  private key(point: GridPoint): string {
    return `${point.x},${point.y}`;
  }

  private parseKey(key: string): GridPoint {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  }

  private pointsEqual(a: GridPoint | undefined, b: GridPoint | undefined): boolean {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  private cloneBoard(board: Board): Board {
    return board.map((row) => [...row]);
  }

  private boardAfterSwap(board: Board, from: GridPoint, to: GridPoint): Board {
    const next = this.cloneBoard(board);
    const tile = next[from.y][from.x];
    next[from.y][from.x] = next[to.y][to.x];
    next[to.y][to.x] = tile;
    return next;
  }
}
