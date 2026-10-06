import { describe, expect, it } from 'vitest';
import { STRINGS } from '../../i18n/strings';
import charset from './ui-charset.txt?raw';

describe('subset font coverage', () => {
  it('ships a glyph for every character the UI can show', () => {
    const covered = new Set(charset);
    const missing = new Set<string>();
    for (const table of Object.values(STRINGS)) {
      for (const text of Object.values(table)) {
        for (const ch of text) {
          if (!covered.has(ch)) {
            missing.add(ch);
          }
        }
      }
    }
    for (const ch of '中文/EN') {
      if (!covered.has(ch)) {
        missing.add(ch);
      }
    }
    expect([...missing].join('')).toBe('');
  });
});
