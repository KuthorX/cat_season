// The whole UI is laid out on a fixed logical stage and scaled uniformly to the viewport,
// so the board and the key are always fully visible and the page never scrolls.

export type StageLayout = 'landscape' | 'portrait';

export interface StageFit {
  layout: StageLayout;
  scale: number;
}

export const STAGE_LAYOUTS: Readonly<Record<StageLayout, { width: number; height: number }>> = {
  landscape: { width: 1280, height: 720 },
  // board on top, key below; used only when it is clearly bigger than the letterboxed landscape stage
  portrait: { width: 720, height: 1440 },
};

const PORTRAIT_GAIN = 1.15;
const MIN_SCALE = 0.05;

function scaleFor(layout: StageLayout, width: number, height: number): number {
  const size = STAGE_LAYOUTS[layout];
  return Math.min(width / size.width, height / size.height);
}

export function chooseStageFit(width: number, height: number): StageFit {
  const landscape = scaleFor('landscape', width, height);
  const portrait = scaleFor('portrait', width, height);
  if (portrait > landscape * PORTRAIT_GAIN) {
    return { layout: 'portrait', scale: Math.max(portrait, MIN_SCALE) };
  }
  return { layout: 'landscape', scale: Math.max(landscape, MIN_SCALE) };
}

/** Writes the fit onto the stage element and keeps it current; `onFit` runs after every change. */
export function mountStageFit(stage: HTMLElement, onFit: () => void): void {
  const apply = (): void => {
    const fit = chooseStageFit(window.innerWidth, window.innerHeight);
    stage.dataset.layout = fit.layout;
    stage.style.setProperty('--fit', String(fit.scale));
    onFit();
  };
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  apply();
}
