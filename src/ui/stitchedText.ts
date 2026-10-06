import { getLocale, t, type Locale, type StringId } from '../i18n';
import manifest from '../assets/art/stitched/manifest.json';

/** Display strings that tools/art/generate.py stitches into images, one per locale. */
export const STITCHED_IDS = ['menu.title', 'menu.start', 'end.lostTitle', 'end.wonTitle', 'end.again'] as const;
export type StitchedId = (typeof STITCHED_IDS)[number];

export type StitchedEntry = { text: string; cols: number; rows: number };

/** What the generator stitched: the source text and the image size in stitches. */
export const STITCHED_MANIFEST = manifest as Record<StitchedId, Record<Locale, StitchedEntry>>;

const FILES = import.meta.glob<string>('../assets/art/stitched/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function stitchedTextUrl(id: StitchedId, locale: Locale = getLocale()): string {
  const url = FILES[`../assets/art/stitched/${id}.${locale}.webp`];
  if (!url) {
    throw new Error(`Missing stitched text "${id}" for ${locale}; run tools/art/generate.py`);
  }
  return url;
}

/**
 * An <img> of the stitched string; the translated text stays available as alt text.
 * `--cols` lets CSS size it to a shared stitch pitch (`--text-st`).
 */
export function stitchedTextHtml(id: StitchedId & StringId, className: string): string {
  const locale = getLocale();
  const { cols } = STITCHED_MANIFEST[id][locale];
  return `<img class="stitched-text ${className}" style="--cols:${cols}" src="${stitchedTextUrl(id, locale)}" alt="${t(id)}" />`;
}
