import Phaser from 'phaser';
import { ASSET_KEYS, ASSET_PATHS, THREAD } from '../assets/manifest';
import menuCat from '../assets/art/menu-cat.webp';
import sewingButton from '../assets/art/sewing-button.webp';
import { parseShotMode } from '../debug/shotMode';
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
import { onLocaleChange, t, toggleLocale } from '../i18n';
import { EndScreen } from '../ui/endScreen';
import { HudController } from '../ui/hud';
import { languageToggleHtml } from '../ui/languageToggle';
import { stitchedTextHtml } from '../ui/stitchedText';
import { BOARD_ORIGIN, BOARD_PIXELS, BOARD_SIZE, CELL_SIZE, GAME_SIZE, STITCH, cellToWorld, worldToCell } from './boardLayout';

const MENU_FONT = '24px "Fusion Pixel"';

type TileView = {
  container: Phaser.GameObjects.Container;
  content: Phaser.GameObjects.Container;
  outline: Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Image;
  kind: TileKind;
  scaleTween?: Phaser.Tweens.Tween;
  invalidTween?: Phaser.Tweens.Tween;
};

export class GameplayScene extends Phaser.Scene {
  private state!: PuzzleState;
  private hud?: HudController;
  private endScreen?: EndScreen;
  private selected?: GridPoint;
  private tileViews = new Map<string, TileView>();
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private hintGraphics?: Phaser.GameObjects.Graphics;
  private boardFrame?: Phaser.GameObjects.Image;
  private targetGraphics?: Phaser.GameObjects.Graphics;
  private boardLayer?: Phaser.GameObjects.Container;
  private boardInputZone?: Phaser.GameObjects.Zone;
  private pendingPowerUp?: PowerUpKind;
  private inputLocked = false;
  private hovered?: GridPoint;
  private lastBoardSignature?: string;
  private music?: Phaser.Sound.BaseSound;
  private audioStarted = false;
  private menuRoot?: HTMLElement;
  private menuLocaleButton?: HTMLButtonElement;
  private unsubscribeMenuLocale?: () => void;
  private startButton?: HTMLButtonElement;

  constructor() {
    super('gameplay');
  }

  preload(): void {
    const reportProgress = (fraction: number): void => window.CatBoot?.report('assets', fraction);
    this.load.on(Phaser.Loader.Events.PROGRESS, reportProgress);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.load.off(Phaser.Loader.Events.PROGRESS, reportProgress));
    this.load.image(ASSET_KEYS.board, ASSET_PATHS.board);
    for (const kind of TILE_KINDS) {
      this.load.image(ASSET_KEYS.tile[kind], ASSET_PATHS.tile[kind]);
    }
    this.load.image(ASSET_KEYS.fx.stitch, ASSET_PATHS.fx.stitch);
    this.load.image(ASSET_KEYS.fx.thread, ASSET_PATHS.fx.thread);
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
    this.applyShotMode();
    void this.revealMenu();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupGameState({ destroyHud: true, removeDocumentListeners: true }));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupGameState({ destroyHud: true, removeDocumentListeners: true }));
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /** Hold the boot loader until the menu's font and art are ready, then fetch the music in the background. */
  private async revealMenu(): Promise<void> {
    const pending: Promise<unknown>[] = [
      document.fonts.load(MENU_FONT),
      ...Array.from(this.menuRoot?.querySelectorAll('img') ?? [], (img) => img.decode()),
    ];
    let settled = 0;
    window.CatBoot?.report('ready', 0);
    await Promise.allSettled(
      pending.map((task) =>
        task.finally(() => {
          settled += 1;
          window.CatBoot?.report('ready', settled / pending.length);
        }),
      ),
    );
    window.CatBoot?.finish();
    this.loadMusic();
  }

  private applyShotMode(): void {
    const mode = parseShotMode(globalThis.location?.search ?? '');
    if (!mode) {
      return;
    }

    this.startNewPuzzle();
    if (mode === 'end') {
      this.state = { ...this.state, movesLeft: 0, status: 'lost', score: 4860, round: 3 };
      this.updateHud();
    }
  }

  private startNewPuzzle = (): void => {
    this.hideStartMenu();
    this.endScreen?.hide();
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
    this.boardFrame?.destroy();
    this.boardFrame = this.add.image(GAME_SIZE / 2, GAME_SIZE / 2, ASSET_KEYS.board).setDepth(1);
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

    const endRoot = document.getElementById('end-root');
    if (!endRoot) {
      throw new Error('Missing #end-root');
    }
    this.endScreen = new EndScreen(endRoot, this.handlePlayAgain);
  }

  private handlePlayAgain = (): void => {
    this.ensureAudioStarted();
    this.playSound(ASSET_KEYS.audio.click, { volume: 0.42 });
    this.startNewPuzzle();
  };

  private showStartMenu(): void {
    const root = document.getElementById('menu-root');
    if (!root) {
      throw new Error('Missing #menu-root');
    }

    this.menuRoot = root;
    document.getElementById('app')?.classList.add('is-menu-open');
    root.hidden = false;
    root.innerHTML = `
      ${languageToggleHtml('menu-lang-toggle')}
      <div class="menu-content">
        <img class="menu-cat" style="--cols:88" src="${menuCat}" alt="" aria-hidden="true" />
        <h1>${stitchedTextHtml('menu.title', 'menu-title')}</h1>
        <p class="menu-copy">${t('menu.copy')}</p>
        <button class="menu-start sew-button" type="button">
          <img class="sew-button-art" src="${sewingButton}" alt="" aria-hidden="true" />
          ${stitchedTextHtml('menu.start', 'sew-label')}
        </button>
      </div>
    `;

    this.startButton = root.querySelector<HTMLButtonElement>('.menu-start') ?? undefined;
    this.startButton?.addEventListener('click', this.handleStartClick);
    this.menuLocaleButton = root.querySelector<HTMLButtonElement>('[data-action="toggle-locale"]') ?? undefined;
    this.menuLocaleButton?.addEventListener('click', toggleLocale);
    this.unsubscribeMenuLocale ??= onLocaleChange(this.handleMenuLocaleChange);
  }

  private handleMenuLocaleChange = (): void => {
    if (!this.startButton) {
      return;
    }

    this.startButton.removeEventListener('click', this.handleStartClick);
    this.menuLocaleButton?.removeEventListener('click', toggleLocale);
    this.showStartMenu();
    this.menuRoot?.querySelector<HTMLButtonElement>('[data-action="toggle-locale"]')?.focus();
  };

  private hideStartMenu(): void {
    this.startButton?.removeEventListener('click', this.handleStartClick);
    this.startButton = undefined;
    this.menuLocaleButton?.removeEventListener('click', toggleLocale);
    this.menuLocaleButton = undefined;
    this.unsubscribeMenuLocale?.();
    this.unsubscribeMenuLocale = undefined;
    if (this.menuRoot) {
      this.menuRoot.hidden = true;
      this.menuRoot.innerHTML = '';
    }
    document.getElementById('app')?.classList.remove('is-menu-open');

    const hudRoot = document.getElementById('hud-root');
    if (hudRoot) {
      hudRoot.hidden = false;
    }
    // The canvas parent may have changed size while the menu covered it.
    this.scale.refresh();
  }

  private handleStartClick = (): void => {
    this.ensureAudioStarted();
    this.playSound(ASSET_KEYS.audio.click, { volume: 0.42 });
    this.startNewPuzzle();
  };

  private setupAudio(): void {
    if (!this.sound.locked) {
      this.ensureAudioStarted();
      return;
    }

    this.sound.once(Phaser.Sound.Events.UNLOCKED, this.ensureAudioStarted);
  }

  private ensureAudioStarted = (): void => {
    if (this.audioStarted) {
      return;
    }

    this.audioStarted = true;
    this.startMusic();
  };

  /** The music is the biggest download, so it never blocks startup; it joins in once it lands. */
  private loadMusic(): void {
    if (this.cache.audio.exists(ASSET_KEYS.audio.music)) {
      this.attachMusic();
      return;
    }

    this.load.audio(ASSET_KEYS.audio.music, [{ type: 'opus', url: ASSET_PATHS.audio.music }]);
    this.load.once(Phaser.Loader.Events.COMPLETE, this.attachMusic);
    this.load.start();
  }

  private attachMusic = (): void => {
    if (this.music || !this.sys.isActive() || !this.cache.audio.exists(ASSET_KEYS.audio.music)) {
      return;
    }

    this.music = this.sound.add(ASSET_KEYS.audio.music, {
      loop: true,
      volume: 0.18,
    });
    this.startMusic();
  };

  private startMusic(): void {
    if (this.audioStarted && this.music && !this.music.isPlaying) {
      this.music.play();
    }
  }

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
    const { x, y } = cellToWorld(point);
    const container = this.add.container(x, y).setSize(CELL_SIZE, CELL_SIZE);
    const content = this.add.container(0, 0).setSize(CELL_SIZE, CELL_SIZE);
    const sprite = this.add.image(0, 0, ASSET_KEYS.tile[kind]).setDisplaySize(CELL_SIZE, CELL_SIZE);
    const outline = this.add.graphics();

    content.add([sprite, outline]);
    container.add(content);
    this.boardLayer?.add(container);
    this.tileViews.set(this.key(point), { container, content, outline, sprite, kind });
  }

  private createBoardInputZone(): void {
    this.boardInputZone = this.add
      .zone(BOARD_ORIGIN + BOARD_PIXELS / 2, BOARD_ORIGIN + BOARD_PIXELS / 2, BOARD_PIXELS, BOARD_PIXELS)
      .setDepth(40)
      .setInteractive();
    this.boardInputZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const point = worldToCell(pointer.worldX, pointer.worldY);
      if (point) {
        this.handleBoardPointer(point, pointer.id);
      }
    });
    this.boardInputZone.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      this.setHovered(worldToCell(pointer.worldX, pointer.worldY));
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
      const { x, y } = cellToWorld(point);
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

    const fromWorld = cellToWorld(from);
    const toWorld = cellToWorld(to);
    this.tweens.add({ targets: fromView.container, x: toWorld.x, y: toWorld.y, duration: 170, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: toView.container, x: fromWorld.x, y: fromWorld.y, duration: 170, ease: 'Sine.easeInOut' });
  }

  private burstParticles(x: number, y: number, kind: TileKind): void {
    const thread = THREAD.tile[kind];
    for (let index = 0; index < 12; index += 1) {
      const isStitch = index % 3 !== 0;
      const particle = this.add
        .image(x, y, isStitch ? ASSET_KEYS.fx.stitch : ASSET_KEYS.fx.thread)
        .setDepth(35)
        .setTint(thread);
      const angle = (index / 12) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.25, 0.25);
      const distance = Phaser.Math.Between(34, 78);
      particle.setScale(isStitch ? Phaser.Math.FloatBetween(0.4, 0.6) : Phaser.Math.FloatBetween(0.8, 1.1));
      particle.setAngle(Phaser.Math.Between(-20, 20));
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + Phaser.Math.Between(6, 22),
        scale: 0,
        alpha: 0,
        angle: particle.angle + Phaser.Math.Between(-90, 90),
        duration: Phaser.Math.Between(460, 720),
        ease: 'Cubic.easeOut',
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
    this.drawPowerUpTarget();
  }

  /** Previews the row (wand) or column (stamp) the armed power-up would clear. */
  private drawPowerUpTarget(): void {
    this.targetGraphics?.destroy();
    this.targetGraphics = undefined;
    const kind = this.pendingPowerUp;
    if (!kind || kind === 'snack') {
      return;
    }

    const graphics = this.add.graphics().setDepth(30);
    this.targetGraphics = graphics;
    const hovered = this.hovered;
    if (!hovered) {
      this.drawRunningStitch(graphics, BOARD_ORIGIN, BOARD_ORIGIN, BOARD_PIXELS, BOARD_PIXELS, THREAD.madder, 0.9, 4);
      return;
    }

    if (kind === 'wand') {
      this.drawRunningStitch(graphics, BOARD_ORIGIN, BOARD_ORIGIN + hovered.y * CELL_SIZE, BOARD_PIXELS, CELL_SIZE, THREAD.madder, 1, 5);
    } else {
      this.drawRunningStitch(graphics, BOARD_ORIGIN + hovered.x * CELL_SIZE, BOARD_ORIGIN, CELL_SIZE, BOARD_PIXELS, THREAD.madder, 1, 5);
    }
  }

  /** A dashed "over one, under one" stitch line following the aida grid. */
  private drawRunningStitch(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    thickness: number,
  ): void {
    const inset = thickness / 2 + 2;
    const left = x + inset;
    const top = y + inset;
    const right = x + width - inset;
    const bottom = y + height - inset;
    graphics.lineStyle(thickness, color, alpha);
    const dash = STITCH;
    for (let p = left; p < right; p += dash * 2) {
      const end = Math.min(p + dash, right);
      graphics.lineBetween(p, top, end, top);
      graphics.lineBetween(p, bottom, end, bottom);
    }
    for (let p = top; p < bottom; p += dash * 2) {
      const end = Math.min(p + dash, bottom);
      graphics.lineBetween(left, p, left, end);
      graphics.lineBetween(right, p, right, end);
    }
  }

  private syncTileVisual(point: GridPoint): void {
    const view = this.tileViews.get(this.key(point));
    if (!view) {
      return;
    }

    const isSelected = this.pointsEqual(this.selected, point);
    const isHovered = this.pointsEqual(this.hovered, point);
    const targetScale = isSelected ? 1.08 : isHovered && !this.pendingPowerUp ? 1.04 : 1;

    view.outline.clear();
    if (isSelected) {
      this.drawRunningStitch(view.outline, -CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, THREAD.madder, 1, 5);
    } else if (isHovered && !this.pendingPowerUp) {
      this.drawRunningStitch(view.outline, -CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, THREAD.straw, 0.9, 3);
    }
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
    this.tweens.add({ targets: this.hintGraphics, alpha: { from: 1, to: 0.35 }, duration: 380, yoyo: true, repeat: -1 });
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
    this.setSelected(undefined);
    this.hud?.setArmedPowerUp(this.pendingPowerUp);
    this.drawPowerUpTarget();
  };

  private applyPowerUp(kind: PowerUpKind, point: GridPoint): void {
    const boardBeforePowerUp = this.cloneBoard(this.state.board);
    const result = usePowerUp(this.state, kind, point);
    this.pendingPowerUp = undefined;
    this.hud?.setArmedPowerUp(undefined);
    this.drawPowerUpTarget();
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

        const target = cellToWorld(point);
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

      const target = cellToWorld(drop.to);
      const source = drop.from && sourceBoard[drop.from.y]?.[drop.from.x] === drop.kind
        ? cellToWorld(drop.from)
        : { x: target.x, y: BOARD_ORIGIN - CELL_SIZE * 0.7 };
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

      const target = cellToWorld(move.to);
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

  private drawHintCell(point: GridPoint): void {
    if (!this.hintGraphics) {
      return;
    }

    const { x, y } = cellToWorld(point);
    this.drawRunningStitch(this.hintGraphics, x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE, THREAD.straw, 1, 6);
  }

  private clearHint = (): void => {
    this.hintGraphics?.destroy();
    this.hintGraphics = undefined;
  };

  private updateHud(): void {
    this.hud?.update(this.state);
    if (this.state.status !== 'playing') {
      this.endScreen?.show(this.state);
    }
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
    this.hud?.setArmedPowerUp(undefined);
    this.targetGraphics?.destroy();
    this.targetGraphics = undefined;
    this.inputLocked = false;
    this.hovered = undefined;

    if (opts.destroyHud || !opts.keepHud) {
      this.hud?.destroy();
      this.hud = undefined;
      this.endScreen?.hide();
      this.endScreen = undefined;
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
