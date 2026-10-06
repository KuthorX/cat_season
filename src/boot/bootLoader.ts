// The first-paint loader. vite.config.ts compiles this file to an inline classic script
// (global `CatBoot`), so it runs before any JS chunk arrives and must not import anything.

export type BootPhase = 'scripts' | 'assets' | 'ready';
export type BootLocale = 'zh' | 'en';

export interface BootChunk {
  url: string;
  size: number;
}

export interface BootConfig {
  /** Module entry, injected once every chunk has been fetched (and is in the HTTP cache). */
  entry: string;
  chunks: BootChunk[];
}

/** Share of the bar each phase owns: JS download, Phaser's loader, then fonts + menu art. */
export const PHASE_SPANS: Readonly<Record<BootPhase, readonly [number, number]>> = {
  scripts: [0, 0.7],
  assets: [0.7, 0.95],
  ready: [0.95, 1],
};

export const STITCH_COUNT = 24;
export const LOCALE_STORAGE_KEY = 'cat-season.locale';

const LABELS: Record<BootLocale, string> = { zh: '加载中…', en: 'Loading…' };

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function overallProgress(phase: BootPhase, fraction: number): number {
  const [from, to] = PHASE_SPANS[phase];
  return from + (to - from) * clamp01(fraction);
}

/** The bar never runs backwards, whatever order reports arrive in. */
export function advance(shown: number, target: number): number {
  return Math.max(clamp01(shown), clamp01(target));
}

export function byteFraction(loaded: number, total: number): number {
  return total > 0 ? clamp01(loaded / total) : 0;
}

export function filledStitches(progress: number, count: number = STITCH_COUNT): number {
  return Math.floor(clamp01(progress) * count);
}

/** Floors, so "100%" only shows once everything really is done. */
export function percentLabel(progress: number): string {
  return `${Math.floor(clamp01(progress) * 100)}%`;
}

export function bootLocale(stored: string | null | undefined, language: string | undefined): BootLocale {
  if (stored === 'zh' || stored === 'en') {
    return stored;
  }
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function loaderLabel(locale: BootLocale): string {
  return LABELS[locale];
}

// ---------- DOM side (browser only) ----------

let shown = 0;
let finished = false;

function root(): HTMLElement | null {
  return document.getElementById('boot-loader');
}

function render(progress: number): void {
  const el = root();
  if (!el) {
    return;
  }
  const filled = filledStitches(progress);
  el.querySelectorAll('.boot-x').forEach((stitch, index) => stitch.classList.toggle('on', index < filled));
  const pct = el.querySelector('.boot-pct');
  if (pct) {
    pct.textContent = percentLabel(progress);
  }
  el.setAttribute('aria-valuenow', String(Math.floor(progress * 100)));
}

export function report(phase: BootPhase, fraction: number): void {
  if (finished) {
    return;
  }
  shown = advance(shown, overallProgress(phase, fraction));
  render(shown);
}

/** Fill the last stitches, fade the cloth away and drop it from the DOM. */
export function finish(): void {
  if (finished) {
    return;
  }
  report('ready', 1);
  finished = true;
  const el = root();
  if (!el) {
    return;
  }
  el.classList.add('is-done');
  window.setTimeout(() => el.remove(), 450);
}

async function fetchCounting(url: string, onBytes: (bytes: number) => void): Promise<void> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${url}`);
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    onBytes(value.byteLength);
  }
}

function injectEntry(entry: string): void {
  const script = document.createElement('script');
  script.type = 'module';
  script.crossOrigin = 'anonymous';
  script.src = entry;
  document.body.append(script);
}

/** Paint the loader in the player's language, then (in builds) download the JS with byte progress. */
export function start(config: BootConfig | null): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Sandboxed iframes can deny storage; fall back to the browser language.
  }
  const locale = bootLocale(stored, navigator.language);
  const el = root();
  if (el) {
    const label = el.querySelector('.boot-label');
    if (label) {
      label.textContent = loaderLabel(locale);
    }
    el.setAttribute('aria-label', loaderLabel(locale));
    el.querySelector('.boot-row')?.replaceChildren(
      ...Array.from({ length: STITCH_COUNT }, () => Object.assign(document.createElement('i'), { className: 'boot-x' })),
    );
  }
  render(shown);

  if (!config) {
    return;
  }
  const total = config.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  let loaded = 0;
  const downloads = config.chunks.map((chunk) =>
    fetchCounting(chunk.url, (bytes) => {
      loaded += bytes;
      report('scripts', byteFraction(loaded, total));
    }),
  );
  // Whatever happens to the progress fetches, the game itself must still load.
  void Promise.allSettled(downloads).then(() => injectEntry(config.entry));
}
