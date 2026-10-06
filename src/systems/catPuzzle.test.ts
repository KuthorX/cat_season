import { describe, expect, it } from 'vitest';
import {
  applyMove,
  createPuzzle,
  findMatches,
  findSuggestedMove,
  repairDeadBoard,
  usePowerUp,
  type Board,
  type GridPoint,
} from './catPuzzle';

const p = (x: number, y: number): GridPoint => ({ x, y });

describe('cat puzzle rules', () => {
  it('finds horizontal and vertical matches of cat-themed tiles', () => {
    const board: Board = [
      ['paw', 'paw', 'paw', 'fish'],
      ['yarn', 'bell', 'milk', 'fish'],
      ['yarn', 'bell', 'milk', 'fish'],
      ['milk', 'yarn', 'bell', 'paw'],
    ];

    const matches = findMatches(board);

    expect(matches.map((match) => match.kind)).toEqual(['paw', 'fish']);
    expect(matches.map((match) => match.cells)).toEqual([
      [p(0, 0), p(1, 0), p(2, 0)],
      [p(3, 0), p(3, 1), p(3, 2)],
    ]);
  });

  it('rejects non-adjacent swaps without spending a move', () => {
    const state = createPuzzle({
      seed: 7,
      width: 4,
      height: 4,
      moves: 9,
      goals: { paw: 3 },
    });

    const result = applyMove(state, p(0, 0), p(2, 0));

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('not-adjacent');
    expect(result.state.movesLeft).toBe(9);
  });

  it('spends one move and reduces goals when a swap creates a match', () => {
    const state = createPuzzle({
      seed: 11,
      width: 4,
      height: 4,
      moves: 6,
      goals: { paw: 3 },
      board: [
        ['paw', 'fish', 'paw', 'bell'],
        ['yarn', 'paw', 'milk', 'fish'],
        ['bell', 'milk', 'yarn', 'milk'],
        ['fish', 'yarn', 'bell', 'paw'],
      ],
    });

    const result = applyMove(state, p(1, 0), p(1, 1));

    expect(result.accepted).toBe(true);
    expect(result.initialMatches).toEqual([
      {
        kind: 'paw',
        cells: [p(0, 0), p(1, 0), p(2, 0)],
      },
    ]);
    expect(result.cleared.paw).toBe(3);
    expect(result.state.goals.paw).toBe(0);
    expect(result.state.movesLeft).toBe(5);
    expect(result.state.status).toBe('won');
  });

  it('reports only actual falling and refilled cells after a clear', () => {
    const state = createPuzzle({
      seed: 11,
      width: 4,
      height: 4,
      moves: 6,
      goals: { paw: 3 },
      board: [
        ['paw', 'fish', 'paw', 'bell'],
        ['yarn', 'paw', 'milk', 'fish'],
        ['bell', 'milk', 'yarn', 'milk'],
        ['fish', 'yarn', 'bell', 'paw'],
      ],
    });

    const result = applyMove(state, p(1, 0), p(1, 1));

    expect(result.accepted).toBe(true);
    expect(result.drops).toEqual([
      { kind: expect.anything(), to: p(0, 0) },
      { kind: expect.anything(), to: p(1, 0) },
      { kind: expect.anything(), to: p(2, 0) },
    ]);
    expect(result.drops.every((drop) => drop.from === undefined)).toBe(true);
    expect(result.drops.some((drop) => drop.from?.x === 3)).toBe(false);
  });

  it('advances to the next round instead of ending when endless goals are cleared', () => {
    const state = createPuzzle({
      seed: 11,
      width: 4,
      height: 4,
      moves: 6,
      mode: 'endless',
      goals: { paw: 3 },
      board: [
        ['paw', 'fish', 'paw', 'bell'],
        ['yarn', 'paw', 'milk', 'fish'],
        ['bell', 'milk', 'yarn', 'milk'],
        ['fish', 'yarn', 'bell', 'paw'],
      ],
    });

    const result = applyMove(state, p(1, 0), p(1, 1));

    expect(result.accepted).toBe(true);
    expect(result.state.mode).toBe('endless');
    expect(result.state.status).toBe('playing');
    expect(result.state.round).toBe(2);
    expect(result.state.movesLeft).toBeGreaterThan(5);
    expect(result.state.goals.paw).toBeGreaterThan(0);
    expect(Object.values(result.state.inventory).some((count) => count > 0)).toBe(true);
  });

  it('uses a catnip snack power-up to add moves and consume inventory', () => {
    const state = createPuzzle({
      seed: 17,
      width: 4,
      height: 4,
      moves: 2,
      mode: 'endless',
      goals: { fish: 3 },
      inventory: { snack: 1 },
    });

    const result = usePowerUp(state, 'snack');

    expect(result.accepted).toBe(true);
    expect(result.state.movesLeft).toBe(7);
    expect(result.state.inventory.snack).toBe(0);
  });

  it('clears a stale notice once the next move is played', () => {
    const state = createPuzzle({
      seed: 11,
      width: 4,
      height: 4,
      moves: 6,
      mode: 'endless',
      goals: { fish: 30 },
      inventory: { snack: 1 },
      board: [
        ['paw', 'fish', 'paw', 'bell'],
        ['yarn', 'paw', 'milk', 'fish'],
        ['bell', 'milk', 'yarn', 'milk'],
        ['fish', 'yarn', 'bell', 'paw'],
      ],
    });

    const snacked = usePowerUp(state, 'snack').state;
    expect(snacked.lastNotice).toBe('snackUsed');

    const moved = applyMove(snacked, p(1, 0), p(1, 1));
    expect(moved.accepted).toBe(true);
    expect(moved.state.lastNotice).not.toBe('snackUsed');
  });

  it('uses a teaser wand power-up to clear one row and reduce goals', () => {
    const state = createPuzzle({
      seed: 19,
      width: 4,
      height: 4,
      moves: 4,
      mode: 'endless',
      goals: { paw: 3, fish: 3 },
      inventory: { wand: 1 },
      board: [
        ['paw', 'fish', 'paw', 'fish'],
        ['yarn', 'bell', 'milk', 'fish'],
        ['bell', 'milk', 'yarn', 'paw'],
        ['milk', 'bell', 'paw', 'yarn'],
      ],
    });

    const result = usePowerUp(state, 'wand', p(2, 0));

    expect(result.accepted).toBe(true);
    expect(result.cleared.paw).toBe(2);
    expect(result.cleared.fish).toBe(2);
    expect(result.state.goals.paw).toBe(1);
    expect(result.state.goals.fish).toBe(1);
    expect(result.state.inventory.wand).toBe(0);
    expect(result.affectedCells).toEqual([p(0, 0), p(1, 0), p(2, 0), p(3, 0)]);
  });

  it('creates seeded boards with no immediate matches', () => {
    const state = createPuzzle({
      seed: 31,
      width: 7,
      height: 7,
      moves: 18,
      goals: { fish: 10, yarn: 8 },
    });

    expect(findMatches(state.board)).toHaveLength(0);
  });

  it('creates seeded boards with at least one playable swap', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createPuzzle({
        seed,
        width: 7,
        height: 7,
        moves: 18,
        goals: { paw: 8, bell: 8 },
      });

      expect(findSuggestedMove(state), `seed ${seed}`).toBeDefined();
    }
  });

  it('finds a suggested adjacent swap when the board has a playable move', () => {
    const state = createPuzzle({
      seed: 23,
      width: 4,
      height: 4,
      moves: 6,
      goals: { fish: 3 },
      board: [
        ['paw', 'fish', 'paw', 'bell'],
        ['fish', 'yarn', 'fish', 'milk'],
        ['bell', 'milk', 'yarn', 'paw'],
        ['milk', 'bell', 'paw', 'yarn'],
      ],
    });

    expect(findSuggestedMove(state)).toEqual({
      from: p(1, 0),
      to: p(1, 1),
    });
  });

  it('reshuffles a dead board using the existing tile pool and rewards a power-up', () => {
    const state = createPuzzle({
      seed: 1,
      width: 7,
      height: 7,
      moves: 6,
      mode: 'endless',
      goals: { paw: 1, bell: 0, tuna: 0 },
      inventory: { snack: 1, wand: 0, stamp: 0 },
      board: [
        ['milk', 'bell', 'tuna', 'cushion', 'paw', 'star', 'yarn'],
        ['fish', 'milk', 'bell', 'tuna', 'cushion', 'paw', 'star'],
        ['yarn', 'fish', 'milk', 'bell', 'tuna', 'cushion', 'paw'],
        ['star', 'yarn', 'fish', 'milk', 'bell', 'tuna', 'cushion'],
        ['paw', 'star', 'yarn', 'fish', 'milk', 'bell', 'tuna'],
        ['cushion', 'paw', 'star', 'yarn', 'fish', 'milk', 'bell'],
        ['tuna', 'cushion', 'paw', 'star', 'yarn', 'fish', 'milk'],
      ],
    });

    expect(findSuggestedMove(state)).toBeUndefined();
    const repaired = repairDeadBoard(state);

    expect(repaired.repaired).toBe(true);
    expect(repaired.reason).toBe('dead-board');
    expect(repaired.state.board).not.toEqual(state.board);
    expect(sortedTiles(repaired.state.board)).toEqual(sortedTiles(state.board));
    expect(repaired.shuffleMoves).toContainEqual({
      kind: 'bell',
      from: p(1, 0),
      to: expect.any(Object),
    });
    expect(findMatches(repaired.state.board)).toHaveLength(0);
    expect(findSuggestedMove(repaired.state)).toBeDefined();
    expect(repaired.state.inventory.snack + repaired.state.inventory.wand + repaired.state.inventory.stamp).toBeGreaterThan(
      state.inventory.snack + state.inventory.wand + state.inventory.stamp,
    );
  });
});

function sortedTiles(board: Board): string[] {
  return board.flat().sort();
}
