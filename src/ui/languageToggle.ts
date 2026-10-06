import { getLocale, t } from '../i18n';

/** Markup for the "中文 / EN" toggle; the active language is highlighted. */
export function languageToggleHtml(className: string): string {
  const locale = getLocale();
  const label = t('lang.toggleLabel');
  return `
    <button class="lang-toggle ${className}" type="button" data-action="toggle-locale" aria-label="${label}" title="${label}">
      <span class="${locale === 'zh' ? 'is-active' : ''}" lang="zh-CN">中文</span>
      <span aria-hidden="true">/</span>
      <span class="${locale === 'en' ? 'is-active' : ''}" lang="en">EN</span>
    </button>
  `;
}
