import { describe, expect, it } from 'vitest';
import { STAGE_LAYOUTS, chooseStageFit } from './fitStage';

describe('chooseStageFit', () => {
  it('scales the landscape stage uniformly to the limiting side', () => {
    expect(chooseStageFit(1280, 720)).toEqual({ layout: 'landscape', scale: 1 });
    expect(chooseStageFit(640, 360)).toEqual({ layout: 'landscape', scale: 0.5 });
    expect(chooseStageFit(1800, 1200)).toEqual({ layout: 'landscape', scale: 1800 / 1280 });
    expect(chooseStageFit(1024, 768)).toEqual({ layout: 'landscape', scale: 0.8 });
  });

  it('switches to the tall stage on phones held upright', () => {
    const fit = chooseStageFit(390, 844);
    expect(fit.layout).toBe('portrait');
    expect(fit.scale).toBeCloseTo(390 / STAGE_LAYOUTS.portrait.width);
  });

  it('never lets the stage spill outside the viewport', () => {
    for (const [w, h] of [[960, 540], [1920, 1080], [375, 667], [800, 1280], [300, 900]]) {
      const fit = chooseStageFit(w, h);
      const size = STAGE_LAYOUTS[fit.layout];
      expect(size.width * fit.scale).toBeLessThanOrEqual(w + 1e-9);
      expect(size.height * fit.scale).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  it('falls back to a usable scale for empty viewports', () => {
    expect(chooseStageFit(0, 0).scale).toBeGreaterThan(0);
  });
});
