export const TILE_KINDS = ['paw', 'fish', 'yarn', 'bell', 'milk', 'cushion', 'tuna', 'star'] as const;
export const POWER_UP_KINDS = ['snack', 'wand', 'stamp'] as const;

export type TileKind = (typeof TILE_KINDS)[number];
export type PowerUpKind = (typeof POWER_UP_KINDS)[number];
export type Board = TileKind[][];
export type GameMode = 'goals' | 'endless';
export type PuzzleStatus = 'playing' | 'won' | 'lost';
/** Notice ids are translated by the UI layer (see src/i18n). */
export type PuzzleNotice = 'snackUsed' | 'autoShuffle';

export type GridPoint = {
  x: number;
  y: number;
};

export type Goals = Partial<Record<TileKind, number>>;
export type Inventory = Record<PowerUpKind, number>;

export type PuzzleState = {
  board: Board;
  width: number;
  height: number;
  movesLeft: number;
  goals: Goals;
  inventory: Inventory;
  mode: GameMode;
  round: number;
  seed: number;
  score: number;
  status: PuzzleStatus;
  lastNotice?: PuzzleNotice;
};

export type Match = {
  kind: TileKind;
  cells: GridPoint[];
};

export type ShuffleMove = {
  kind: TileKind;
  from: GridPoint;
  to: GridPoint;
};

export type TileDrop = {
  kind: TileKind;
  from?: GridPoint;
  to: GridPoint;
};

export type CreatePuzzleOptions = {
  seed: number;
  width: number;
  height: number;
  moves: number;
  goals: Goals;
  mode?: GameMode;
  round?: number;
  inventory?: Partial<Inventory>;
  board?: Board;
};

export type MoveResult = {
  accepted: boolean;
  reason?: 'not-adjacent' | 'out-of-bounds' | 'no-match' | 'not-playing';
  cleared: Goals;
  initialMatches: Match[];
  matches: Match[];
  affectedCells: GridPoint[];
  cascades: number;
  repaired: boolean;
  rewardedPowerUp?: PowerUpKind;
  shuffleMoves: ShuffleMove[];
  drops: TileDrop[];
  boardBeforeRepair?: Board;
  state: PuzzleState;
};

export type PowerUpResult = {
  accepted: boolean;
  reason?: 'not-playing' | 'empty-inventory' | 'target-required' | 'out-of-bounds';
  cleared: Goals;
  affectedCells: GridPoint[];
  repaired: boolean;
  rewardedPowerUp?: PowerUpKind;
  shuffleMoves: ShuffleMove[];
  drops: TileDrop[];
  boardBeforeRepair?: Board;
  state: PuzzleState;
};

export type RepairResult = {
  repaired: boolean;
  reason?: 'dead-board';
  rewardedPowerUp?: PowerUpKind;
  shuffleMoves: ShuffleMove[];
  boardBeforeRepair?: Board;
  state: PuzzleState;
};

export type SuggestedMove = {
  from: GridPoint;
  to: GridPoint;
};

type RandomState = {
  seed: number;
};

export function createPuzzle(options: CreatePuzzleOptions): PuzzleState {
  const board = options.board
    ? cloneBoard(options.board)
    : createStableBoard(options.width, options.height, options.seed);

  return {
    board,
    width: options.width,
    height: options.height,
    movesLeft: options.moves,
    goals: { ...options.goals },
    inventory: {
      snack: options.inventory?.snack ?? 0,
      wand: options.inventory?.wand ?? 0,
      stamp: options.inventory?.stamp ?? 0,
    },
    mode: options.mode ?? 'goals',
    round: options.round ?? 1,
    seed: options.seed,
    score: 0,
    status: isWon(options.goals) ? 'won' : 'playing',
  };
}

export function applyMove(state: PuzzleState, from: GridPoint, to: GridPoint): MoveResult {
  if (state.status !== 'playing') {
    return rejected(state, 'not-playing');
  }

  if (!isInside(state, from) || !isInside(state, to)) {
    return rejected(state, 'out-of-bounds');
  }

  if (distance(from, to) !== 1) {
    return rejected(state, 'not-adjacent');
  }

  const nextBoard = cloneBoard(state.board);
  swap(nextBoard, from, to);

  const firstMatches = findMatches(nextBoard);
  if (firstMatches.length === 0) {
    return rejected(state, 'no-match');
  }

  const random: RandomState = { seed: state.seed };
  const cleared: Goals = {};
  let cascades = 0;
  let allMatches: Match[] = [];
  let drops: TileDrop[] = [];
  let matches = firstMatches;

  while (matches.length > 0) {
    cascades += 1;
    allMatches = allMatches.concat(matches);
    collectCleared(cleared, matches);
    clearMatches(nextBoard, matches);
    drops = drops.concat(collapseAndFill(nextBoard, random));
    matches = findMatches(nextBoard);
  }

  const goals = reduceGoals(state.goals, cleared);
  const movesLeft = state.movesLeft - 1;
  const clearedTiles = Object.values(cleared).reduce((total, value) => total + (value ?? 0), 0);
  const nextState = resolveProgress({
    ...state,
    board: nextBoard,
    goals,
    movesLeft,
    seed: random.seed,
    score: state.score + clearedTiles * 60 + Math.max(0, cascades - 1) * 120,
    status: 'playing',
  });
  const repaired = repairDeadBoard(nextState);

  return {
    accepted: true,
    cleared,
    initialMatches: firstMatches,
    matches: allMatches,
    affectedCells: Array.from(uniqueCells(allMatches)).map(parseCellKey),
    cascades,
    repaired: repaired.repaired,
    rewardedPowerUp: repaired.rewardedPowerUp,
    shuffleMoves: repaired.shuffleMoves,
    drops,
    boardBeforeRepair: repaired.boardBeforeRepair,
    state: repaired.state,
  };
}

export function usePowerUp(state: PuzzleState, kind: PowerUpKind, target?: GridPoint): PowerUpResult {
  if (state.status !== 'playing') {
    return rejectedPowerUp(state, 'not-playing');
  }

  if (state.inventory[kind] <= 0) {
    return rejectedPowerUp(state, 'empty-inventory');
  }

  if (kind === 'snack') {
    return {
      accepted: true,
      cleared: {},
      affectedCells: [],
      repaired: false,
      shuffleMoves: [],
      drops: [],
      state: {
        ...state,
        movesLeft: state.movesLeft + 5,
        inventory: spendInventory(state.inventory, kind),
        lastNotice: 'snackUsed',
      },
    };
  }

  if (!target) {
    return rejectedPowerUp(state, 'target-required');
  }

  if (!isInside(state, target)) {
    return rejectedPowerUp(state, 'out-of-bounds');
  }

  const affectedCells = kind === 'wand' ? rowCells(state, target.y) : columnCells(state, target.x);
  const random: RandomState = { seed: state.seed };
  const board = cloneBoard(state.board);
  const cleared = collectCells(board, affectedCells);
  let drops: TileDrop[] = [];

  clearCells(board, affectedCells);
  drops = drops.concat(collapseAndFill(board, random));

  let matches = findMatches(board);
  while (matches.length > 0) {
    collectCleared(cleared, matches);
    clearMatches(board, matches);
    drops = drops.concat(collapseAndFill(board, random));
    matches = findMatches(board);
  }

  const clearedTiles = Object.values(cleared).reduce((total, value) => total + (value ?? 0), 0);
  const nextState = resolveProgress({
    ...state,
    board,
    goals: reduceGoals(state.goals, cleared),
    inventory: spendInventory(state.inventory, kind),
    seed: random.seed,
    score: state.score + clearedTiles * 50,
  });
  const repaired = repairDeadBoard(nextState);

  return {
    accepted: true,
    cleared,
    affectedCells,
    repaired: repaired.repaired,
    rewardedPowerUp: repaired.rewardedPowerUp,
    shuffleMoves: repaired.shuffleMoves,
    drops,
    boardBeforeRepair: repaired.boardBeforeRepair,
    state: repaired.state,
  };
}

export function repairDeadBoard(state: PuzzleState): RepairResult {
  if (state.status !== 'playing' || findSuggestedMove(state)) {
    return {
      repaired: false,
      shuffleMoves: [],
      state,
    };
  }

  const random: RandomState = { seed: (state.seed + 97) >>> 0 };
  const shuffled = shuffleExistingBoard(state, random);
  const board = shuffled.board;
  const reward = POWER_UP_KINDS[(state.seed + state.round) % POWER_UP_KINDS.length];

  return {
    repaired: true,
    reason: 'dead-board',
    rewardedPowerUp: reward,
    shuffleMoves: shuffled.shuffleMoves,
    boardBeforeRepair: cloneBoard(state.board),
    state: {
      ...state,
      board,
      seed: random.seed,
      inventory: {
        ...state.inventory,
        [reward]: state.inventory[reward] + 1,
      },
      lastNotice: 'autoShuffle',
    },
  };
}

export function findMatches(board: Board): Match[] {
  const matches: Match[] = [];
  const height = board.length;
  const width = board[0]?.length ?? 0;

  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      const kind = board[y][x];
      let end = x + 1;
      while (end < width && board[y][end] === kind) {
        end += 1;
      }
      if (end - x >= 3) {
        matches.push({
          kind,
          cells: range(x, end).map((cellX) => ({ x: cellX, y })),
        });
      }
      x = end;
    }
  }

  for (let x = 0; x < width; x += 1) {
    let y = 0;
    while (y < height) {
      const kind = board[y][x];
      let end = y + 1;
      while (end < height && board[end][x] === kind) {
        end += 1;
      }
      if (end - y >= 3) {
        matches.push({
          kind,
          cells: range(y, end).map((cellY) => ({ x, y: cellY })),
        });
      }
      y = end;
    }
  }

  return matches;
}

export function canSwap(state: PuzzleState, from: GridPoint, to: GridPoint): boolean {
  if (!isInside(state, from) || !isInside(state, to) || distance(from, to) !== 1) {
    return false;
  }

  const board = cloneBoard(state.board);
  swap(board, from, to);
  return findMatches(board).length > 0;
}

export function findSuggestedMove(state: PuzzleState): SuggestedMove | undefined {
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const from = { x, y };
      const right = { x: x + 1, y };
      if (canSwap(state, from, right)) {
        return { from, to: right };
      }

      const down = { x, y: y + 1 };
      if (canSwap(state, from, down)) {
        return { from, to: down };
      }
    }
  }

  return undefined;
}

function rejected(state: PuzzleState, reason: MoveResult['reason']): MoveResult {
  return {
    accepted: false,
    reason,
    cleared: {},
    initialMatches: [],
    matches: [],
    affectedCells: [],
    cascades: 0,
    repaired: false,
    shuffleMoves: [],
    drops: [],
    state,
  };
}

function rejectedPowerUp(state: PuzzleState, reason: PowerUpResult['reason']): PowerUpResult {
  return {
    accepted: false,
    reason,
    cleared: {},
    affectedCells: [],
    repaired: false,
    shuffleMoves: [],
    drops: [],
    state,
  };
}

function shuffleExistingBoard(state: PuzzleState, random: RandomState): { board: Board; shuffleMoves: ShuffleMove[] } {
  const tiles = flattenBoard(state.board);
  const originalSignature = boardSignature(state.board);
  const maxAttempts = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const shuffledTiles = shuffledCopy(tiles, random);
    const board = boardFromTiles(shuffledTiles, state.width, state.height);
    const candidate = {
      ...state,
      board,
    };

    if (
      boardSignature(board) !== originalSignature
      && findMatches(board).length === 0
      && findSuggestedMove(candidate)
    ) {
      return {
        board,
        shuffleMoves: buildShuffleMoves(shuffledTiles, state.width),
      };
    }
  }

  return {
    board: cloneBoard(state.board),
    shuffleMoves: [],
  };
}

function flattenBoard(board: Board): Array<{ kind: TileKind; from: GridPoint }> {
  const tiles: Array<{ kind: TileKind; from: GridPoint }> = [];
  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < (board[y]?.length ?? 0); x += 1) {
      tiles.push({
        kind: board[y][x],
        from: { x, y },
      });
    }
  }
  return tiles;
}

function shuffledCopy<T>(items: T[], random: RandomState): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = nextInt(random, index + 1);
    const item = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = item;
  }
  return copy;
}

function boardFromTiles(tiles: Array<{ kind: TileKind }>, width: number, height: number): Board {
  const board: Board = [];
  for (let y = 0; y < height; y += 1) {
    board[y] = [];
    for (let x = 0; x < width; x += 1) {
      board[y][x] = tiles[y * width + x].kind;
    }
  }
  return board;
}

function buildShuffleMoves(tiles: Array<{ kind: TileKind; from: GridPoint }>, width: number): ShuffleMove[] {
  const moves: ShuffleMove[] = [];
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index];
    const to = {
      x: index % width,
      y: Math.floor(index / width),
    };
    if (tile.from.x === to.x && tile.from.y === to.y) {
      continue;
    }
    moves.push({
      kind: tile.kind,
      from: { ...tile.from },
      to,
    });
  }
  return moves;
}

function boardSignature(board: Board): string {
  return board.map((row) => row.join('|')).join('/');
}

function createStableBoard(width: number, height: number, seed: number): Board {
  const random: RandomState = { seed };
  const board: Board = [];

  fillStableBoard(board, width, height, random);

  const state = {
    board,
    width,
    height,
    movesLeft: 1,
    goals: {},
    inventory: { snack: 0, wand: 0, stamp: 0 },
    mode: 'goals',
    round: 1,
    seed,
    score: 0,
    status: 'playing',
  } satisfies PuzzleState;

  if (!findSuggestedMove(state)) {
    placeGuaranteedMove(board);
  }

  return board;
}

function fillStableBoard(board: Board, width: number, height: number, random: RandomState): void {
  for (let y = 0; y < height; y += 1) {
    board[y] = [];
    for (let x = 0; x < width; x += 1) {
      board[y][x] = pickStableTile(board, x, y, random);
    }
  }
}

function placeGuaranteedMove(board: Board): void {
  if (board.length < 3 || (board[0]?.length ?? 0) < 3) {
    return;
  }

  board[0][0] = 'paw';
  board[0][1] = 'fish';
  board[0][2] = 'paw';
  board[1][0] = 'yarn';
  board[1][1] = 'paw';
  board[1][2] = 'bell';
  board[2][0] = 'bell';
  board[2][1] = 'milk';
  board[2][2] = 'cushion';
}

function pickStableTile(board: Board, x: number, y: number, random: RandomState): TileKind {
  const blocked = new Set<TileKind>();
  if (x >= 2 && board[y][x - 1] === board[y][x - 2]) {
    blocked.add(board[y][x - 1]);
  }
  if (y >= 2 && board[y - 1][x] === board[y - 2][x]) {
    blocked.add(board[y - 1][x]);
  }

  const candidates = TILE_KINDS.filter((kind) => !blocked.has(kind));
  return candidates[nextInt(random, candidates.length)];
}

function collapseAndFill(board: Board, random: RandomState): TileDrop[] {
  const height = board.length;
  const width = board[0]?.length ?? 0;
  const drops: TileDrop[] = [];

  for (let x = 0; x < width; x += 1) {
    const column: Array<{ kind: TileKind; from: GridPoint }> = [];
    for (let y = height - 1; y >= 0; y -= 1) {
      const tile = board[y][x];
      if (tile) {
        column.push({ kind: tile, from: { x, y } });
      }
    }

    for (let y = height - 1; y >= 0; y -= 1) {
      const tile = column.shift();
      if (tile) {
        board[y][x] = tile.kind;
        if (tile.from.y !== y) {
          drops.push({
            kind: tile.kind,
            from: tile.from,
            to: { x, y },
          });
        }
        continue;
      }

      const kind = TILE_KINDS[nextInt(random, TILE_KINDS.length)];
      board[y][x] = kind;
      drops.push({
        kind,
        to: { x, y },
      });
    }
  }

  return drops;
}

function resolveProgress(state: PuzzleState): PuzzleState {
  if (!isWon(state.goals)) {
    return {
      ...state,
      status: state.movesLeft <= 0 ? 'lost' : 'playing',
    };
  }

  if (state.mode !== 'endless') {
    return {
      ...state,
      status: 'won',
    };
  }

  const nextRound = state.round + 1;
  return {
    ...state,
    goals: createRoundGoals(nextRound),
    inventory: rewardInventory(state.inventory, nextRound),
    movesLeft: state.movesLeft + 8 + Math.min(5, nextRound),
    round: nextRound,
    status: 'playing',
    score: state.score + nextRound * 250,
  };
}

function createRoundGoals(round: number): Goals {
  const first = TILE_KINDS[(round + 1) % TILE_KINDS.length];
  const second = TILE_KINDS[(round + 4) % TILE_KINDS.length];
  const third = TILE_KINDS[(round + 6) % TILE_KINDS.length];

  return {
    [first]: 7 + round,
    [second]: 6 + Math.floor(round * 0.8),
    [third]: 5 + Math.floor(round * 0.6),
  };
}

function rewardInventory(inventory: Inventory, round: number): Inventory {
  const reward = POWER_UP_KINDS[round % POWER_UP_KINDS.length];
  return {
    ...inventory,
    [reward]: inventory[reward] + 1,
  };
}

function spendInventory(inventory: Inventory, kind: PowerUpKind): Inventory {
  return {
    ...inventory,
    [kind]: Math.max(0, inventory[kind] - 1),
  };
}

function rowCells(state: PuzzleState, y: number): GridPoint[] {
  return range(0, state.width).map((x) => ({ x, y }));
}

function columnCells(state: PuzzleState, x: number): GridPoint[] {
  return range(0, state.height).map((y) => ({ x, y }));
}

function collectCells(board: Board, cells: GridPoint[]): Goals {
  const cleared: Goals = {};
  for (const cell of cells) {
    const kind = board[cell.y]?.[cell.x];
    if (kind) {
      cleared[kind] = (cleared[kind] ?? 0) + 1;
    }
  }
  return cleared;
}

function clearCells(board: Board, cells: GridPoint[]): void {
  for (const cell of cells) {
    delete board[cell.y][cell.x];
  }
}

function clearMatches(board: Board, matches: Match[]): void {
  const seen = uniqueCells(matches);
  for (const key of seen) {
    const [x, y] = key.split(',').map(Number);
    delete board[y][x];
  }
}

function collectCleared(cleared: Goals, matches: Match[]): void {
  const seenByKind = new Map<TileKind, Set<string>>();
  for (const match of matches) {
    const seen = seenByKind.get(match.kind) ?? new Set<string>();
    for (const cell of match.cells) {
      seen.add(cellKey(cell));
    }
    seenByKind.set(match.kind, seen);
  }

  for (const [kind, cells] of seenByKind) {
    cleared[kind] = (cleared[kind] ?? 0) + cells.size;
  }
}

function reduceGoals(goals: Goals, cleared: Goals): Goals {
  const next: Goals = {};
  for (const kind of TILE_KINDS) {
    const value = goals[kind];
    if (value === undefined) {
      continue;
    }
    next[kind] = Math.max(0, value - (cleared[kind] ?? 0));
  }
  return next;
}

function isWon(goals: Goals): boolean {
  return Object.values(goals).every((value) => (value ?? 0) <= 0);
}

function uniqueCells(matches: Match[]): Set<string> {
  const cells = new Set<string>();
  for (const match of matches) {
    for (const cell of match.cells) {
      cells.add(cellKey(cell));
    }
  }
  return cells;
}

function cellKey(cell: GridPoint): string {
  return `${cell.x},${cell.y}`;
}

function parseCellKey(key: string): GridPoint {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function swap(board: Board, a: GridPoint, b: GridPoint): void {
  const tile = board[a.y][a.x];
  board[a.y][a.x] = board[b.y][b.x];
  board[b.y][b.x] = tile;
}

function isInside(state: PuzzleState, point: GridPoint): boolean {
  return point.x >= 0 && point.x < state.width && point.y >= 0 && point.y < state.height;
}

function distance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, index) => start + index);
}

function nextInt(random: RandomState, max: number): number {
  random.seed = (random.seed * 1664525 + 1013904223) >>> 0;
  return random.seed % max;
}
