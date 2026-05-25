import { ASSET_PATHS, POWER_UP_DESCRIPTIONS, POWER_UP_LABELS, TILE_LABELS } from '../assets/manifest';
import { findSuggestedMove, POWER_UP_KINDS, type PowerUpKind, type PuzzleState, type TileKind } from '../systems/catPuzzle';

export type HudActions = {
  onNewGame: () => void;
  onHint: () => void;
  onPowerUp: (kind: PowerUpKind) => void;
};

export class HudController {
  private readonly root: HTMLElement;
  private readonly actions: HudActions;
  private state?: PuzzleState;

  constructor(root: HTMLElement, actions: HudActions) {
    this.root = root;
    this.actions = actions;
  }

  mount(): void {
    this.root.innerHTML = `
      <div class="brand-block">
        <h1>猫咪季节</h1>
      </div>
      <div class="status-grid">
        <div class="stat-box">
          <span class="stat-label">步数</span>
          <strong data-hud="moves">0</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">分数</span>
          <strong data-hud="score">0</strong>
        </div>
        <div class="stat-box">
          <span class="stat-label">轮次</span>
          <strong data-hud="round">1</strong>
        </div>
      </div>
      <section class="goal-list" aria-label="收集目标" data-hud="goals"></section>
      <section class="powerup-list" aria-label="猫咪道具" data-hud="powerups"></section>
      <p class="result-line" data-hud="result"></p>
      <div class="command-row">
        <button class="icon-button primary" type="button" data-action="new-game" aria-label="重新开始" title="重新开始">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v6h-6" />
          </svg>
        </button>
        <button class="icon-button" type="button" data-action="hint" aria-label="提示一步" title="提示一步">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9.09 9a3 3 0 1 1 5.82 1c-.55 1.38-2.91 1.74-2.91 4" />
            <path d="M12 18h.01" />
          </svg>
        </button>
      </div>
    `;

    this.root.querySelector('[data-action="new-game"]')?.addEventListener('click', this.actions.onNewGame);
    this.root.querySelector('[data-action="hint"]')?.addEventListener('click', this.actions.onHint);
  }

  update(state: PuzzleState): void {
    this.state = state;
    this.setText('moves', String(state.movesLeft));
    this.setText('score', new Intl.NumberFormat('zh-CN').format(state.score));
    this.setText('round', String(state.round));
    this.renderGoals(state);
    this.renderPowerUps(state);
    this.renderResult(state);
  }

  destroy(): void {
    this.root.querySelector('[data-action="new-game"]')?.removeEventListener('click', this.actions.onNewGame);
    this.root.querySelector('[data-action="hint"]')?.removeEventListener('click', this.actions.onHint);
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
              <span>${TILE_LABELS[tileKind]}</span>
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
          <span class="powerup-name">${POWER_UP_LABELS[kind]}</span>
          <span class="powerup-desc">${POWER_UP_DESCRIPTIONS[kind]}</span>
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
      result.textContent = '本局猫咪小物已经全部收好了。';
      result.dataset.status = 'won';
      return;
    }

    if (state.status === 'lost') {
      result.textContent = '步数用完了，猫咪已经开始午睡。';
      result.dataset.status = 'lost';
      return;
    }

    if (state.lastNotice) {
      result.textContent = state.lastNotice;
      result.dataset.status = 'playing';
      return;
    }

    const hint = this.state ? findSuggestedMove(this.state) : undefined;
    result.textContent = hint ? '棋盘上还有可以交换的一步。' : '没有可交换的一步，系统会自动整理棋盘。';
    result.dataset.status = 'playing';
  }

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
