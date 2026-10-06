/**
 * Screenshot hook for headless captures: `?shot=game` starts a round straight away and
 * `?shot=end` jumps to the out-of-moves screen. Any other URL plays normally.
 */
export type ShotMode = 'game' | 'end';

export function parseShotMode(search: string): ShotMode | undefined {
  const value = new URLSearchParams(search).get('shot');
  return value === 'game' || value === 'end' ? value : undefined;
}
