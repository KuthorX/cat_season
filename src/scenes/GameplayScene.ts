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
  type TileKind,
} from '../systems/catPuzzle';
import { HudController } from '../ui/hud';

const BOARD_SIZE = 7;
const TILE_SIZE = 68;
const TILE_GAP = 8;
const BOARD_PADDING = 24;
const BOARD_X = 232;
const BOARD_Y = 72;

type TileView = {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  bg: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Image;
  kind: TileKind;
};

export class GameplayScene extends Phaser.Scene {
  private state!: PuzzleState;
  private hud?: HudController;
  private selected?: GridPoint;
  private tileViews = new Map<string, TileView>();
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private hintGraphics?: Phaser.GameObjects.Graphics;
  private boardLayer?: Phaser.GameObjects.Container;
  private boardInputZone?: Phaser.GameObjects.Zone;
  private pendingPowerUp?: PowerUpKind;
  private inputLocked = false;
  private hovered?: GridPoint;
  private lastBoardSignature?: string;

  constructor() {
    super('gameplay');
  }

  preload(): void {
    this.load.image(ASSET_KEYS.background, ASSET_PATHS.background);
    for (const kind of TILE_KINDS) {
      this.load.svg(ASSET_KEYS.tile[kind], ASSET_PATHS.tile[kind], { width: 96, height: 96 });
    }
    this.load.svg(ASSET_KEYS.fx.pawParticle, ASSET_PATHS.fx.pawParticle, { width: 32, height: 32 });
    this.load.svg(ASSET_KEYS.fx.sparkleParticle, ASSET_PATHS.fx.sparkleParticle, { width: 32, height: 32 });
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.createBackdrop();
    this.createBoardFrame();
    this.createHud();
    this.startNewPuzzle();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupGameState({ destroyHud: true, removeDocumentListeners: true }));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupGameState({ destroyHud: true, removeDocumentListeners: true }));
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private startNewPuzzle = (): void => {
    this.cleanupGameState({ keepHud: true });
    this.state = this.createRandomPuzzle();
    this.lastBoardSignature = this.boardSignature(this.state.board);

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

  private createBackdrop(): void {
    const bg = this.add.image(480, 320, ASSET_KEYS.background);
    bg.setDisplaySize(960, 640);
    bg.setAlpha(0.95);

    this.add.rectangle(480, 320, 960, 640, 0x13272b, 0.32);
    this.add.rectangle(480, 320, 960, 640, 0xf8efe2, 0.1);
  }

  private createBoardFrame(): void {
    const width = BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_GAP + BOARD_PADDING * 2;
    const height = width;
    const x = BOARD_X + width / 2 - BOARD_PADDING;
    const y = BOARD_Y + height / 2 - BOARD_PADDING;

    this.add.rectangle(x + 8, y + 12, width, height, 0x102229, 0.34).setDepth(1);
    this.add.rectangle(x, y, width, height, 0xfff4df, 0.88).setDepth(2);
    this.add.rectangle(x, y, width - 12, height - 12, 0x223f45, 0.12).setDepth(3);
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
    const shadow = this.add.ellipse(2, 6, TILE_SIZE * 0.86, TILE_SIZE * 0.72, 0x153238, 0.15);
    const bg = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0xfff8e8, 0.98);
    const sprite = this.add.image(0, 0, ASSET_KEYS.tile[kind]).setDisplaySize(50, 50);

    bg.setStrokeStyle(2, 0x2f5861, 0.2);
    container.add([shadow, bg, sprite]);
    this.boardLayer?.add(container);
    this.tileViews.set(this.key(point), { container, shadow, bg, sprite, kind });
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

    this.clearHint();
    if (this.pendingPowerUp) {
      this.applyPowerUp(this.pendingPowerUp, point);
      return;
    }

    const selected = this.selected;
    if (!selected) {
      this.setSelected(point);
      return;
    }

    if (this.pointsEqual(selected, point)) {
      this.setSelected(undefined);
      return;
    }

    const boardBeforeMove = this.cloneBoard(this.state.board);
    const boardAfterSwap = this.boardAfterSwap(boardBeforeMove, selected, point);
    const result = applyMove(this.state, selected, point);
    if (!result.accepted) {
      this.setSelected(point);
      this.signalInvalid(point, pointerId);
      return;
    }

    this.inputLocked = true;
    this.state = result.state;
    this.setSelected(undefined);
    this.setHovered(undefined);
    this.animateAcceptedMove(selected, point, result.initialMatches);
    const timer = this.time.delayedCall(720, () => {
      const targetBoard = result.boardBeforeRepair ?? result.state.board;
      this.renderBoard(targetBoard);
      this.animateBoardArrival(boardAfterSwap, targetBoard, {
        blockedSourceCells: result.affectedCells,
      });
      this.finishBoardUpdate({
        boardBeforeRepair: result.boardBeforeRepair,
        finalState: result.state,
        shuffleMoves: result.shuffleMoves,
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

    this.tweens.add({
      targets: view.container,
      x: view.container.x + (pointerId % 2 === 0 ? 6 : -6),
      yoyo: true,
      repeat: 2,
      duration: 42,
      ease: 'Sine.easeInOut',
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
    this.tweens.killTweensOf(view.container);
    this.tweens.add({
      targets: view.container,
      scale: targetScale,
      duration: 120,
      ease: 'Back.easeOut',
    });
  }

  private showHint = (): void => {
    if (this.state.status !== 'playing') {
      return;
    }

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
      this.signalInvalid(point, 1);
      this.updateHud();
      return;
    }

    this.inputLocked = true;
    this.state = result.state;
    this.setSelected(undefined);
    this.setHovered(undefined);
    this.animateClearCells(result.affectedCells);
    const timer = this.time.delayedCall(520, () => {
      const targetBoard = result.boardBeforeRepair ?? result.state.board;
      this.renderBoard(targetBoard);
      this.animateBoardArrival(boardBeforePowerUp, targetBoard, {
        blockedSourceCells: result.affectedCells,
      });
      this.finishBoardUpdate({
        boardBeforeRepair: result.boardBeforeRepair,
        finalState: result.state,
        shuffleMoves: result.shuffleMoves,
        delay: result.boardBeforeRepair ? 520 : 430,
      });
    });
    this.activeTimers.push(timer);
  }

  private finishBoardUpdate(options: {
    boardBeforeRepair?: Board;
    finalState: PuzzleState;
    shuffleMoves: ShuffleMove[];
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
        this.animateBoardArrival(options.boardBeforeRepair, options.finalState.board, { intro: false });
      }
      this.updateHud();
      this.inputLocked = false;
    });
    this.activeTimers.push(timer);
  }

  private animateBoardArrival(
    sourceBoard: Board | undefined,
    targetBoard: Board,
    options: { blockedSourceCells?: GridPoint[]; intro?: boolean } = {},
  ): void {
    const blocked = new Set((options.blockedSourceCells ?? []).map((cell) => this.key(cell)));
    const sources = sourceBoard ? this.collectSourceCells(sourceBoard, blocked) : new Map<TileKind, GridPoint[]>();

    for (let y = 0; y < targetBoard.length; y += 1) {
      for (let x = 0; x < (targetBoard[y]?.length ?? 0); x += 1) {
        const point = { x, y };
        const view = this.tileViews.get(this.key(point));
        if (!view) {
          continue;
        }

        const target = this.cellToWorld(point);
        const source = sources.get(view.kind)?.shift();
        const isSameCell = source && this.pointsEqual(source, point);
        const sourceWorld = source && !isSameCell
          ? this.cellToWorld(source)
          : {
              x: target.x + (options.intro ? Phaser.Math.Between(-10, 10) : 0),
              y: options.intro ? target.y - Phaser.Math.Between(42, 96) : target.y - 18,
            };

        view.container.setPosition(sourceWorld.x, sourceWorld.y);
        view.container.setAlpha(isSameCell ? 0.92 : 0.58);
        view.container.setScale(isSameCell ? 0.96 : 0.78);
        view.container.setAngle(source && !isSameCell ? Phaser.Math.Between(-6, 6) : 0);
        this.tweens.add({
          targets: view.container,
          x: target.x,
          y: target.y,
          alpha: 1,
          scale: 1,
          angle: 0,
          duration: source && !isSameCell ? 360 : 430,
          delay: y * 22 + x * 5,
          ease: source && !isSameCell ? 'Back.easeOut' : 'Bounce.easeOut',
        });
      }
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
            this.animateBoardArrival(boardBeforeRepair, finalState.board, { intro: false });
            onComplete();
          }
        },
      });
    }

    for (let y = 0; y < finalState.height; y += 1) {
      for (let x = 0; x < finalState.width; x += 1) {
        const point = { x, y };
        if (shuffleMoves.some((move) => this.pointsEqual(move.from, point))) {
          continue;
        }
        const view = this.tileViews.get(this.key(point));
        if (view) {
          this.tweens.add({
            targets: view.container,
            scale: 1.04,
            yoyo: true,
            duration: 140,
            delay: Phaser.Math.Between(40, 180),
            ease: 'Sine.easeInOut',
          });
        }
      }
    }
  }

  private collectSourceCells(board: Board, blocked: Set<string>): Map<TileKind, GridPoint[]> {
    const sources = new Map<TileKind, GridPoint[]>();
    for (let y = 0; y < board.length; y += 1) {
      for (let x = 0; x < (board[y]?.length ?? 0); x += 1) {
        const point = { x, y };
        if (blocked.has(this.key(point))) {
          continue;
        }
        const kind = board[y][x];
        const cells = sources.get(kind) ?? [];
        cells.push(point);
        sources.set(kind, cells);
      }
    }
    return sources;
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
    this.tileViews.forEach((view) => view.container.destroy(true));
    this.tileViews.clear();
    this.boardInputZone?.destroy();
    this.boardInputZone = undefined;
    this.boardLayer?.destroy(true);
    this.boardLayer = undefined;
    this.pendingPowerUp = undefined;
    this.inputLocked = false;
    this.hovered = undefined;

    if (opts.destroyHud || !opts.keepHud) {
      this.hud?.destroy();
      this.hud = undefined;
    }

    if (opts.removeDocumentListeners) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
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
