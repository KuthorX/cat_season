import { describe, expect, it } from 'vitest';
import { LOCALES } from '../i18n';
import { STRINGS } from '../i18n/strings';
import { STITCHED_IDS, STITCHED_MANIFEST, stitchedTextUrl } from './stitchedText';

describe('stitched display text', () => {
  it('has an image for every id in every locale', () => {
    for (const id of STITCHED_IDS) {
      for (const locale of LOCALES) {
        expect(stitchedTextUrl(id, locale), `${id}.${locale}`).toBeTruthy();
      }
    }
  });

  it('was stitched from the current translations (re-run tools/art/generate.py if this fails)', () => {
    for (const id of STITCHED_IDS) {
      for (const locale of LOCALES) {
        const entry = STITCHED_MANIFEST[id]?.[locale];
        expect(entry?.text, `${id}.${locale}`).toBe(STRINGS[locale][id]);
        expect(entry?.cols, `${id}.${locale} cols`).toBeGreaterThan(0);
      }
    }
  });
});
