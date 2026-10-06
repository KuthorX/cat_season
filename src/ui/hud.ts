import { ASSET_PATHS } from '../assets/manifest';
import { formatNumber, onLocaleChange, t, toggleLocale } from '../i18n';
import { findSuggestedMove, POWER_UP_KINDS, type PowerUpKind, type PuzzleState, type TileKind } from '../systems/catPuzzle';
import { languageToggleHtml } from './languageToggle';

export type HudActions = {
  onNewGame: () => void;
  onHint: () => void;
  onPowerUp: (kind: PowerUpKind) => void;
};

export class HudController {
  private readonly root: HTMLElement;
  private readonly actions: HudActions;
  private state?: PuzzleState;
  private unsubscribeLocale?: () => void;

  constructor(root: HTMLElement, actions: HudActions) {
    this.root = root;
    this.actions = actions;
  }

  mount(): void {
    this.unsubscribeLocale ??= onLocaleChange(this.handleLocaleChange);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="brand-block">
        <h1>${t('hud.title')}</h1>
      </div>
      <div class="status-grid">
        <div class="stat-box">
          <span class="stat-label">${t('hud.moves')}</span>
          <strong data-hud="moves">0</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">${t('hud.score')}</span>
          <strong data-hud="score">0</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">${t('hud.round')}</span>
          <strong data-hud="round">1</strong>
        </div>
      </div>
      <section class="goal-list" aria-label="${t('hud.goalsLabel')}" data-hud="goals"></section>
      <section class="powerup-list" aria-label="${t('hud.powerupsLabel')}" data-hud="powerups"></section>
      <p class="result-line" data-hud="result"></p>
      <div class="command-row">
        <button class="icon-button primary" type="button" data-action="new-game" aria-label="${t('hud.restart')}" title="${t('hud.restart')}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v6h-6" />
          </svg>
        </button>
        <button class="icon-button" type="button" data-action="hint" aria-label="${t('hud.hint')}" title="${t('hud.hint')}">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9.09 9a3 3 0 1 1 5.82 1c-.55 1.38-2.91 1.74-2.91 4" />
            <path d="M12 18h.01" />
          </svg>
        </button>
        ${languageToggleHtml('hud-lang-toggle')}
      </div>
    `;

    this.root.querySelector('[data-action="new-game"]')?.addEventListener('click', this.actions.onNewGame);
    this.root.querySelector('[data-action="hint"]')?.addEventListener('click', this.actions.onHint);
    this.root.querySelector('[data-action="toggle-locale"]')?.addEventListener('click', toggleLocale);
  }

  update(state: PuzzleState): void {
    this.state = state;
    this.setText('moves', String(state.movesLeft));
    this.setText('score', formatNumber(state.score));
    this.setText('round', String(state.round));
    this.renderGoals(state);
    this.renderPowerUps(state);
    this.renderResult(state);
  }

  destroy(): void {
    this.root.querySelector('[data-action="new-game"]')?.removeEventListener('click', this.actions.onNewGame);
    this.root.querySelector('[data-action="hint"]')?.removeEventListener('click', this.actions.onHint);
    this.root.querySelector('[data-action="toggle-locale"]')?.removeEventListener('click', toggleLocale);
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = undefined;
    for (const button of this.root.querySelectorAll('[data-powerup]')) {
      button.removeEventListener('click', this.handlePowerUpClick);
    }
    this.root.innerHTML = '';
    this.state = undefined;
  }

  private renderGoals(state: PuzzleState): void {
    const goals = this.root.querySelector<HTMLElement>('[data-hud="goals"]');
    if (!goals) {
      return;
    }

    goals.innerHTML = Object.entries(state.goals)
      .map(([kind, value]) => {
        const tileKind = kind as TileKind;
        return `
          <div class="goal-row ${value <= 0 ? 'is-complete' : ''}">
            <span class="goal-name">
              <img class="goal-icon" src="${ASSET_PATHS.tile[tileKind]}" alt="" aria-hidden="true" />
              <span>${t(`tile.${tileKind}`)}</span>
            </span>
            <strong>${Math.max(0, value)}</strong>
          </div>
        `;
      })
      .join('');
  }

  private renderPowerUps(state: PuzzleState): void {
    const powerups = this.root.querySelector<HTMLElement>('[data-hud="powerups"]');
    if (!powerups) {
      return;
    }

    for (const button of powerups.querySelectorAll('[data-powerup]')) {
      button.removeEventListener('click', this.handlePowerUpClick);
    }

    powerups.innerHTML = POWER_UP_KINDS.map((kind) => {
      const count = state.inventory[kind];
      return `
        <button class="powerup-button" type="button" data-powerup="${kind}" ${count <= 0 ? 'disabled' : ''}>
          <span class="powerup-name">${t(`powerup.${kind}.name`)}</span>
          <span class="powerup-desc">${t(`powerup.${kind}.desc`)}</span>
          <strong>${count}</strong>
        </button>
      `;
    }).join('');

    for (const button of powerups.querySelectorAll('[data-powerup]')) {
      button.addEventListener('click', this.handlePowerUpClick);
    }
  }

  private renderResult(state: PuzzleState): void {
    const result = this.root.querySelector<HTMLElement>('[data-hud="result"]');
    if (!result) {
      return;
    }

    if (state.status === 'won') {
      result.textContent = t('result.won');
      result.dataset.status = 'won';
      return;
    }

    if (state.status === 'lost') {
      result.textContent = t('result.lost');
      result.dataset.status = 'lost';
      return;
    }

    if (state.lastNotice) {
      result.textContent = t(`notice.${state.lastNotice}`);
      result.dataset.status = 'playing';
      return;
    }

    const hint = this.state ? findSuggestedMove(this.state) : undefined;
    result.textContent = hint ? t('result.hasMove') : t('result.noMove');
    result.dataset.status = 'playing';
  }

  private handleLocaleChange = (): void => {
    this.render();
    if (this.state) {
      this.update(this.state);
    }
  };

  private handlePowerUpClick = (event: Event): void => {
    const button = event.currentTarget as HTMLElement;
    const kind = button.dataset.powerup as PowerUpKind | undefined;
    if (kind) {
      this.actions.onPowerUp(kind);
    }
  };

  private setText(key: string, value: string): void {
    const node = this.root.querySelector(`[data-hud="${key}"]`);
    if (node) {
      node.textContent = value;
    }
  }
}
