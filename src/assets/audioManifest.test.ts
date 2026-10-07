import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_KEYS, AUDIO_TRIM, audioSources, trimmedVolume, type AudioCue } from './manifest';

const PUBLIC_DIR = resolve(__dirname, '../../public');
const cues = Object.keys(ASSET_KEYS.audio) as AudioCue[];

describe('audio manifest', () => {
  it('ships an Opus file and an MP3 fallback for every cue', () => {
    for (const cue of cues) {
      const sources = audioSources(cue);
      expect(sources.map((source) => source.type)).toEqual(['opus', 'mp3']);
      for (const source of sources) {
        const file = resolve(PUBLIC_DIR, String(source.url));
        expect(existsSync(file), file).toBe(true);
      }
    }
  });

  it('keeps every sound effect small enough to preload', () => {
    for (const cue of cues.filter((name) => name !== 'music')) {
      const [opus] = audioSources(cue);
      expect(statSync(resolve(PUBLIC_DIR, String(opus?.url))).size).toBeLessThan(32 * 1024);
    }
  });

  it('trims every cue by a sane gain and applies it to the call volume', () => {
    for (const cue of cues) {
      expect(AUDIO_TRIM[cue]).toBeGreaterThan(0.1);
      expect(AUDIO_TRIM[cue]).toBeLessThan(1.5);
      expect(trimmedVolume(ASSET_KEYS.audio[cue], 0.5)).toBeCloseTo(0.5 * AUDIO_TRIM[cue]);
    }
    expect(trimmedVolume(ASSET_KEYS.audio.music)).toBe(1);
    expect(trimmedVolume('not-an-audio-key', 0.4)).toBe(0.4);
  });
});
