import { describe, expect, it } from 'vitest';
import { LOCALE_STORAGE_KEY as APP_LOCALE_KEY } from '../i18n';
import {
  LOCALE_STORAGE_KEY,
  PHASE_SPANS,
  STITCH_COUNT,
  advance,
  bootLocale,
  byteFraction,
  filledStitches,
  loaderLabel,
  overallProgress,
  percentLabel,
} from './bootLoader';

describe('boot progress', () => {
  it('maps each phase onto its own contiguous span of the bar', () => {
    expect(overallProgress('scripts', 0)).toBe(0);
    expect(overallProgress('scripts', 1)).toBe(PHASE_SPANS.assets[0]);
    expect(overallProgress('assets', 1)).toBe(PHASE_SPANS.ready[0]);
    expect(overallProgress('ready', 1)).toBe(1);
    expect(overallProgress('assets', 0.5)).toBeCloseTo(0.825);
  });

  it('clamps nonsense fractions', () => {
    expect(overallProgress('assets', -3)).toBe(PHASE_SPANS.assets[0]);
    expect(overallProgress('assets', 7)).toBe(PHASE_SPANS.assets[1]);
    expect(overallProgress('scripts', Number.NaN)).toBe(0);
  });

  it('never moves backwards', () => {
    expect(advance(0.6, 0.4)).toBe(0.6);
    expect(advance(0.6, 0.8)).toBe(0.8);
    expect(advance(0.9, 2)).toBe(1);
  });

  it('turns downloaded bytes into a fraction', () => {
    expect(byteFraction(50, 200)).toBe(0.25);
    expect(byteFraction(300, 200)).toBe(1);
    expect(byteFraction(10, 0)).toBe(0);
  });

  it('fills whole stitches and only shows 100% when done', () => {
    expect(filledStitches(0)).toBe(0);
    expect(filledStitches(0.5)).toBe(STITCH_COUNT / 2);
    expect(filledStitches(1)).toBe(STITCH_COUNT);
    expect(percentLabel(0.999)).toBe('99%');
    expect(percentLabel(1)).toBe('100%');
  });

  it('picks the stored locale first, then the browser language', () => {
    expect(bootLocale('en', 'zh-CN')).toBe('en');
    expect(bootLocale(null, 'zh-TW')).toBe('zh');
    expect(bootLocale('fr', 'en-US')).toBe('en');
    expect(bootLocale(undefined, undefined)).toBe('en');
    expect(loaderLabel('zh')).toBe('加载中…');
    expect(loaderLabel('en')).toBe('Loading…');
    expect(LOCALE_STORAGE_KEY).toBe(APP_LOCALE_KEY);
  });
});
