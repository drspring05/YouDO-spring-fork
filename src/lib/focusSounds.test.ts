import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS_SOUND_PREFS, focusSoundAction, generateNoise, parseFocusSoundPrefs } from './focusSounds';

/** A repeatable random source, so noise tests are stable. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('focus sound settings', () => {
  it('keeps a valid choice and clamps the volume', () => {
    expect(parseFocusSoundPrefs({ sound: 'forest', volume: 1.4, keepPlaying: true })).toEqual({ sound: 'forest', volume: 1, keepPlaying: true });
    expect(parseFocusSoundPrefs({ sound: 'brown', volume: -2 })).toEqual({ sound: 'brown', volume: 0, keepPlaying: false });
  });

  it('falls back to no sound and the default volume for anything unknown', () => {
    expect(parseFocusSoundPrefs({ sound: 'rain', volume: 'loud', keepPlaying: 'yes' })).toEqual(DEFAULT_FOCUS_SOUND_PREFS);
    expect(parseFocusSoundPrefs(null)).toEqual(DEFAULT_FOCUS_SOUND_PREFS);
  });
});

describe('focus sound follows the session', () => {
  const base = { session: true, paused: false, sound: 'guitar' as const, visible: true, keepPlaying: false };

  it('plays while the timer runs, pauses with it, and stops without a session or a sound', () => {
    expect(focusSoundAction(base)).toBe('play');
    expect(focusSoundAction({ ...base, paused: true })).toBe('pause');
    expect(focusSoundAction({ ...base, session: false })).toBe('stop');
    expect(focusSoundAction({ ...base, sound: null })).toBe('stop');
  });

  it('pauses when you leave the app, unless Keep playing is on', () => {
    expect(focusSoundAction({ ...base, visible: false })).toBe('pause');
    expect(focusSoundAction({ ...base, visible: false, keepPlaying: true })).toBe('play');
    expect(focusSoundAction({ ...base, visible: false, keepPlaying: true, paused: true })).toBe('pause');
  });
});

describe('generated noise', () => {
  for (const kind of ['brown', 'pink'] as const) {
    it(`makes ${kind} noise of the right length, in range, with a soft loop point`, () => {
      const out = generateNoise(kind, 48000, seeded());
      expect(out).toHaveLength(48000);
      let peak = 0;
      let step = 0;
      for (let i = 1; i < out.length; i++) {
        peak = Math.max(peak, Math.abs(out[i]));
        step = Math.max(step, Math.abs(out[i] - out[i - 1]));
      }
      expect(peak).toBeGreaterThan(0.01);
      expect(peak).toBeLessThanOrEqual(1);
      // Where the loop joins (last sample to first), the jump is no bigger than any step inside it.
      expect(Math.abs(out[0] - out[out.length - 1])).toBeLessThanOrEqual(step + 1e-6);
    });
  }
});
