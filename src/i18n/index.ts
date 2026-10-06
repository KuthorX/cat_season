import { LOCALES, STRINGS, type Locale, type StringId } from './strings';

export { LOCALES, type Locale, type StringId } from './strings';

export const LOCALE_STORAGE_KEY = 'cat-season.locale';

const HTML_LANG: Record<Locale, string> = { zh: 'zh-CN', en: 'en' };
const NUMBER_LOCALE: Record<Locale, string> = { zh: 'zh-CN', en: 'en-US' };

type LocaleListener = (locale: Locale) => void;

const listeners = new Set<LocaleListener>();

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function detectLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function readStoredLocale(): Locale | undefined {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function initialLocale(): Locale {
  return readStoredLocale() ?? detectLocale(globalThis.navigator?.language);
}

let currentLocale: Locale = initialLocale();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) {
    return;
  }

  currentLocale = locale;
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode, sandboxed iframe); the choice just won't persist.
  }
  applyDocumentLocale();
  for (const listener of listeners) {
    listener(locale);
  }
}

export function toggleLocale(): void {
  setLocale(currentLocale === 'zh' ? 'en' : 'zh');
}

export function onLocaleChange(listener: LocaleListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(id: StringId, locale: Locale = currentLocale): string {
  return STRINGS[locale][id];
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[currentLocale]).format(value);
}

const ARIA_LABELS: Array<[selector: string, id: StringId]> = [
  ['.game-shell', 'doc.shellLabel'],
  ['#game-root', 'doc.boardLabel'],
  ['#menu-root', 'doc.menuLabel'],
  ['#hud-root', 'doc.hudLabel'],
];

export function applyDocumentLocale(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = HTML_LANG[currentLocale];
  document.title = t('doc.title');
  for (const [selector, id] of ARIA_LABELS) {
    document.querySelector(selector)?.setAttribute('aria-label', t(id));
  }
}
