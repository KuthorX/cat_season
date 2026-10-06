import { describe, expect, it } from 'vitest';
import { GLYPHS, stitchedNumberHtml } from './stitchedNumber';

describe('stitchedNumberHtml', () => {
  it('maps each digit to its sprite slot', () => {
    const html = stitchedNumberHtml('409');
    expect(html.match(/--g:\d+/g)).toEqual(['--g:4', '--g:0', '--g:9']);
  });

  it('keeps the readable value for assistive tech and picks the tone', () => {
    const html = stitchedNumberHtml('4,860', 'madder');
    expect(html).toContain('aria-label="4,860"');
    expect(html).toContain('sn-madder');
    expect(html).toContain(`--g:${GLYPHS.indexOf(',')}`);
    expect(html).toContain('sn-narrow');
  });

  it('falls back to text for characters without a stitched glyph', () => {
    const html = stitchedNumberHtml('1 2');
    expect(html).toContain('<span class="sn-text"> </span>');
    expect(html.match(/class="sn"/g)).toHaveLength(2);
  });

  it('never injects markup from unexpected characters', () => {
    expect(stitchedNumberHtml('<b>')).not.toContain('<b>');
  });
});
