import { ASSET_PATHS } from '../assets/manifest';
import toolHint from '../assets/art/tool-hint.webp';
import toolRestart from '../assets/art/tool-restart.webp';
import toolSnack from '../assets/art/tool-snack.webp';
import toolStamp from '../assets/art/tool-stamp.webp';
import toolWand from '../assets/art/tool-wand.webp';
import { formatNumber, onLocaleChange, t, toggleLocale } from '../i18n';
import { POWER_UP_KINDS, type PowerUpKind, type PuzzleState, type TileKind } from '../systems/catPuzzle';
import { languageToggleHtml } from './languageToggle';
import { stitchedNumberHtml } from './stitchedNumber';

const POWER_UP_ART: Record<PowerUpKind, string> = { snack: toolSnack, wand: toolWand, stamp: toolStamp };

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
      <header class="hud-top">
        <dl class="hud-stats">
          <div class="hud-stat is-moves">
            <dt class="stat-label">${t('hud.moves')}</dt>
            <dd data-hud="moves"></dd>
          </div>
          <div class="hud-stat is-score">
            <dt class="stat-label">${t('hud.score')}</dt>
            <dd data-hud="score"></dd>
          </div>
          <div class="hud-stat is-round">
            <dt class="stat-label">${t('hud.round')}</dt>
            <dd data-hud="round"></dd>
          </div>
        </dl>
      </header>
      <section class="goal-list" aria-label="${t('hud.goalsLabel')}" data-hud="goals"></section>
      <section class="powerup-list" aria-label="${t('hud.powerupsLabel')}" data-hud="powerups"></section>
      <p class="result-line" data-hud="result" aria-live="polite"></p>
      <footer class="hud-foot">
        ${languageToggleHtml('hud-lang-toggle')}
        <button class="tool-button" type="button" data-action="hint">
          <img class="tool-icon" src="${toolHint}" alt="" aria-hidden="true" />
          <span>${t('hud.hint')}</span>
        </button>
        <button class="tool-button" type="button" data-action="new-game">
          <img class="tool-icon" src="${toolRestart}" alt="" aria-hidden="true" />
          <span>${t('hud.restart')}</span>
        </button>
      </footer>
    `;

    this.root.querySelector('[data-action="new-game"]')?.addEventListener('click', this.actions.onNewGame);
    this.root.querySelector('[data-action="hint"]')?.addEventListener('click', this.actions.onHint);
    this.root.querySelector('[data-action="toggle-locale"]')?.addEventListener('click', toggleLocale);
  }

  update(state: PuzzleState): void {
    this.state = state;
    this.setHtml('moves', stitchedNumberHtml(String(state.movesLeft), 'madder'));
    this.setHtml('score', stitchedNumberHtml(formatNumber(state.score)));
    this.setHtml('round', stitchedNumberHtml(String(state.round)));
    this.renderGoals(state);
    this.renderPowerUps(state);
    this.renderResult(state);
  }

  /** Marks the power-up waiting for a board target, or clears the mark. */
  setArmedPowerUp(kind: PowerUpKind | undefined): void {
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-powerup]')) {
      const armed = button.dataset.powerup === kind;
      button.classList.toggle('is-armed', armed);
      button.setAttribute('aria-pressed', String(armed));
    }
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
            <img class="goal-icon" src="${ASSET_PATHS.tile[tileKind]}" alt="" aria-hidden="true" />
            <span class="goal-name">${t(`tile.${tileKind}`)}</span>
            <strong>${stitchedNumberHtml(String(Math.max(0, value)))}</strong>
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
        <button class="powerup-button" type="button" data-powerup="${kind}" title="${t(`powerup.${kind}.desc`)}" ${count <= 0 ? 'disabled' : ''}>
          <img class="tool-icon" src="${POWER_UP_ART[kind]}" alt="" aria-hidden="true" />
          <span class="powerup-name">${t(`powerup.${kind}.name`)}</span>
          <span class="powerup-desc">${t(`powerup.${kind}.desc`)}</span>
          <strong class="powerup-count">×${count}</strong>
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

    if (state.status !== 'playing') {
      // The end screen carries the final message; don't repeat it here.
      result.textContent = '';
      result.dataset.status = state.status;
      return;
    }

    // Only real events get a pencil note; an empty line is the normal state.
    result.textContent = state.lastNotice ? t(`notice.${state.lastNotice}`) : '';
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

  private setHtml(key: string, html: string): void {
    const node = this.root.querySelector(`[data-hud="${key}"]`);
    if (node) {
      node.innerHTML = html;
    }
  }
}
