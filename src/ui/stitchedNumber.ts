/** Glyph order in the digit sprite strips painted by tools/art/generate.py. */
export const GLYPHS = '0123456789,×';

export type StitchTone = 'ink' | 'madder';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);
}

/**
 * Renders a short numeric string as cross-stitched glyphs. Characters without a stitched
 * glyph (locale-specific separators, for example) fall back to plain text.
 */
export function stitchedNumberHtml(text: string, tone: StitchTone = 'ink'): string {
  const glyphs = Array.from(text)
    .map((ch) => {
      const index = GLYPHS.indexOf(ch);
      if (index < 0) {
        return `<span class="sn-text">${escapeHtml(ch)}</span>`;
      }
      const narrow = ch === ',' ? ' sn-narrow' : '';
      return `<span class="sn${narrow}" style="--g:${index}"></span>`;
    })
    .join('');
  return `<span class="sn-run sn-${tone}" role="img" aria-label="${escapeHtml(text)}">${glyphs}</span>`;
}
