import { describe, expect, it } from 'vitest';
import { BOARD_ORIGIN, BOARD_PIXELS, BOARD_SIZE, CELL_SIZE, GAME_SIZE, cellToWorld, worldToCell } from './boardLayout';

describe('board layout', () => {
  it('fits the board inside the game canvas', () => {
    expect(BOARD_ORIGIN * 2 + BOARD_PIXELS).toBeLessThanOrEqual(GAME_SIZE);
  });

  it('round-trips every cell centre', () => {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const world = cellToWorld({ x, y });
        expect(worldToCell(world.x, world.y)).toEqual({ x, y });
      }
    }
  });

  it('maps cell edges to the cell they open', () => {
    expect(worldToCell(BOARD_ORIGIN, BOARD_ORIGIN)).toEqual({ x: 0, y: 0 });
    expect(worldToCell(BOARD_ORIGIN + CELL_SIZE, BOARD_ORIGIN + CELL_SIZE - 1)).toEqual({ x: 1, y: 0 });
  });

  it('ignores points outside the board', () => {
    expect(worldToCell(BOARD_ORIGIN - 1, BOARD_ORIGIN + 10)).toBeUndefined();
    expect(worldToCell(BOARD_ORIGIN + 10, BOARD_ORIGIN + BOARD_PIXELS)).toBeUndefined();
  });
});
