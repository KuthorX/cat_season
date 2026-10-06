import { afterEach, describe, expect, it, vi } from 'vitest';
import { POWER_UP_KINDS, TILE_KINDS } from '../systems/catPuzzle';
import { STRINGS } from './strings';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

async function loadI18n(options: { language?: string; stored?: Record<string, string> } = {}) {
  vi.resetModules();
  vi.stubGlobal('navigator', { language: options.language ?? 'en-US' });
  const storage = memoryStorage(options.stored);
  vi.stubGlobal('localStorage', storage);
  const i18n = await import('./index');
  return { i18n, storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('i18n dictionaries', () => {
  it('zh and en define exactly the same keys', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.zh).sort());
  });

  it('has no empty strings and no CJK text in English', () => {
    for (const [id, value] of Object.entries(STRINGS.en)) {
      expect(value.trim(), id).not.toBe('');
      if (id !== 'lang.current') {
        expect(value, id).not.toMatch(/[　-〿一-鿿＀-￯]/);
      }
    }
    for (const [id, value] of Object.entries(STRINGS.zh)) {
      expect(value.trim(), id).not.toBe('');
    }
  });

  it('covers every tile, power-up and notice id used by the game', () => {
    const ids: string[] = [
      ...TILE_KINDS.map((kind) => `tile.${kind}`),
      ...POWER_UP_KINDS.flatMap((kind) => [`powerup.${kind}.name`, `powerup.${kind}.desc`]),
      'notice.snackUsed',
      'notice.autoShuffle',
    ];
    for (const id of ids) {
      expect(STRINGS.zh).toHaveProperty([id]);
      expect(STRINGS.en).toHaveProperty([id]);
    }
  });
});

describe('locale selection', () => {
  it('detects Chinese for any zh* browser language and English otherwise', async () => {
    const { i18n } = await loadI18n();
    expect(i18n.detectLocale('zh-CN')).toBe('zh');
    expect(i18n.detectLocale('zh-TW')).toBe('zh');
    expect(i18n.detectLocale('ZH')).toBe('zh');
    expect(i18n.detectLocale('en-GB')).toBe('en');
    expect(i18n.detectLocale('ja-JP')).toBe('en');
    expect(i18n.detectLocale(undefined)).toBe('en');
  });

  it('uses navigator.language when nothing is stored', async () => {
    expect((await loadI18n({ language: 'zh-CN' })).i18n.getLocale()).toBe('zh');
    expect((await loadI18n({ language: 'fr-FR' })).i18n.getLocale()).toBe('en');
  });

  it('prefers a stored choice over the browser language', async () => {
    const { i18n } = await loadI18n({ language: 'zh-CN', stored: { 'cat-season.locale': 'en' } });
    expect(i18n.getLocale()).toBe('en');
  });

  it('ignores invalid stored values', async () => {
    const { i18n } = await loadI18n({ language: 'zh-CN', stored: { 'cat-season.locale': 'fr' } });
    expect(i18n.getLocale()).toBe('zh');
  });

  it('toggles, persists and notifies listeners', async () => {
    const { i18n, storage } = await loadI18n({ language: 'en-US' });
    const seen: string[] = [];
    const unsubscribe = i18n.onLocaleChange((locale) => seen.push(locale));

    i18n.toggleLocale();
    expect(i18n.getLocale()).toBe('zh');
    expect(storage.getItem(i18n.LOCALE_STORAGE_KEY)).toBe('zh');
    expect(i18n.t('menu.start')).toBe('开始游戏');

    i18n.setLocale('en');
    expect(i18n.t('menu.start')).toBe('Play');
    expect(seen).toEqual(['zh', 'en']);

    unsubscribe();
    i18n.toggleLocale();
    expect(seen).toEqual(['zh', 'en']);
  });

  it('keeps working when localStorage throws', async () => {
    vi.resetModules();
    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const i18n = await import('./index');
    expect(i18n.getLocale()).toBe('en');
    i18n.setLocale('zh');
    expect(i18n.getLocale()).toBe('zh');
  });
});
