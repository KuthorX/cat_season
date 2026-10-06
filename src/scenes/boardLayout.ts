import type { GridPoint } from '../systems/catPuzzle';

/**
 * Board geometry in game pixels. The aida texture (tools/art/generate.py) is painted on
 * the same 8 px stitch grid, so tile motifs land exactly on the cloth's holes.
 */
export const GAME_SIZE = 960;
export const STITCH = 8;
export const BOARD_SIZE = 7;
export const CELL_SIZE = STITCH * 16;
/** Wooden frame (22 px) plus a stitch and a quarter of bare aida. */
export const BOARD_ORIGIN = 32;
export const BOARD_PIXELS = BOARD_SIZE * CELL_SIZE;

export function cellToWorld(point: GridPoint): GridPoint {
  return {
    x: BOARD_ORIGIN + CELL_SIZE / 2 + point.x * CELL_SIZE,
    y: BOARD_ORIGIN + CELL_SIZE / 2 + point.y * CELL_SIZE,
  };
}

export function worldToCell(worldX: number, worldY: number): GridPoint | undefined {
  const localX = worldX - BOARD_ORIGIN;
  const localY = worldY - BOARD_ORIGIN;
  if (localX < 0 || localY < 0 || localX >= BOARD_PIXELS || localY >= BOARD_PIXELS) {
    return undefined;
  }

  return { x: Math.floor(localX / CELL_SIZE), y: Math.floor(localY / CELL_SIZE) };
}
