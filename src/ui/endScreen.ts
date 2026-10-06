import { formatNumber, onLocaleChange, t } from '../i18n';
import type { PuzzleState } from '../systems/catPuzzle';
import { stitchedNumberHtml } from './stitchedNumber';
import { stitchedTextHtml } from './stitchedText';
import sewingButton from '../assets/art/sewing-button.png';

/** Out-of-moves card stitched over the board, with the final tally and a replay button. */
export class EndScreen {
  private readonly root: HTMLElement;
  private readonly onPlayAgain: () => void;
  private state?: PuzzleState;
  private unsubscribeLocale?: () => void;

  constructor(root: HTMLElement, onPlayAgain: () => void) {
    this.root = root;
    this.onPlayAgain = onPlayAgain;
  }

  show(state: PuzzleState): void {
    this.state = state;
    this.unsubscribeLocale ??= onLocaleChange(this.render);
    this.render();
    this.root.hidden = false;
  }

  hide(): void {
    this.unsubscribeLocale?.();
    this.unsubscribeLocale = undefined;
    this.state = undefined;
    this.root.hidden = true;
    this.root.innerHTML = '';
  }

  private render = (): void => {
    const state = this.state;
    if (!state) {
      return;
    }

    const titleId = state.status === 'won' ? 'end.wonTitle' : 'end.lostTitle';
    const body = state.status === 'won' ? t('result.won') : t('result.lost');
    this.root.innerHTML = `
      <div class="end-card" role="dialog" aria-modal="false" aria-labelledby="end-title">
        <h2 id="end-title">${stitchedTextHtml(titleId, 'end-title')}</h2>
        <p class="end-body">${body}</p>
        <dl class="end-tally">
          <div>
            <dt class="stat-label">${t('end.score')}</dt>
            <dd class="end-score">${stitchedNumberHtml(formatNumber(state.score), 'madder')}</dd>
          </div>
          <div>
            <dt class="stat-label">${t('end.round')}</dt>
            <dd class="end-round">${stitchedNumberHtml(String(state.round))}</dd>
          </div>
        </dl>
        <button class="sew-button is-inline" type="button" data-action="play-again">
          <img class="sew-button-art" src="${sewingButton}" alt="" aria-hidden="true" />
          ${stitchedTextHtml('end.again', 'sew-label')}
        </button>
      </div>
    `;
    this.root.querySelector('[data-action="play-again"]')?.addEventListener('click', this.onPlayAgain);
  };
}
