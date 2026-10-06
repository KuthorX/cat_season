import { describe, expect, it } from 'vitest';
import { parseShotMode } from './shotMode';

describe('parseShotMode', () => {
  it('reads the supported shot states', () => {
    expect(parseShotMode('?shot=game')).toBe('game');
    expect(parseShotMode('?lang=en&shot=end')).toBe('end');
  });

  it('ignores missing or unknown values', () => {
    expect(parseShotMode('')).toBeUndefined();
    expect(parseShotMode('?shot=menu')).toBeUndefined();
    expect(parseShotMode('?shot=END')).toBeUndefined();
  });
});
