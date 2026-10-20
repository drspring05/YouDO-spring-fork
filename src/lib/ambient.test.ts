import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIFT_RANGE, ambientAutoOpenEnabled, ambientDrift, formatAmbientTimer, ambientTipSeen, isNightHour, markAmbientTipSeen, setAmbientAutoOpen } from './ambient';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
});
beforeEach(() => store.clear());

describe('ambient clock', () => {
  it('shows the timer without a leading zero, like the iPhone timer', () => {
    expect([0, 598, 2398, 5998, 36000].map(formatAmbientTimer)).toEqual(['0:00', '9:58', '39:58', '1:39:58', '10:00:00']);
  });

  it('turns night mode on from 21:00 to 06:00', () => {
    expect([20, 21, 23, 0, 5, 6].map(isNightHour)).toEqual([false, true, true, true, true, false]);
  });

  it('drifts within a few pixels and keeps moving', () => {
    const points = Array.from({ length: 60 }, (_, i) => ambientDrift(i + 1));
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(DRIFT_RANGE + 1);
    expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBeGreaterThan(20);
  });

  it('opens when sideways by default, and remembers the switch', () => {
    expect(ambientAutoOpenEnabled()).toBe(true);
    setAmbientAutoOpen(false);
    expect(ambientAutoOpenEnabled()).toBe(false);
  });

  it('shows the tip once', () => {
    expect(ambientTipSeen()).toBe(false);
    markAmbientTipSeen();
    expect(ambientTipSeen()).toBe(true);
  });
});
