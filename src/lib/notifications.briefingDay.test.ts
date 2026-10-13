import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalNode } from '../types';

const schedule = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: (...args: unknown[]) => schedule(...args),
    cancel: vi.fn().mockResolvedValue(undefined),
    createChannel: vi.fn().mockResolvedValue(undefined),
  },
}));

const { refreshMorningBriefing, resetBriefingSchedulingGuard, scheduleMorningBriefing } = await import('./notifications');

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const goal: GoalNode = {
  id: 'gate',
  kind: 'goal',
  title: 'GATE 2027',
  endDate: '2026-12-31',
  children: [],
  completed: false,
  createdAt: 1,
};

describe('morning briefing content', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', memoryStorage);
    schedule.mockClear();
    resetBriefingSchedulingGuard();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('counts days left from the delivery morning, not the evening it was scheduled', async () => {
    // Scheduled at 21:00 on Oct 12 for the default 04:00 briefing on Oct 13.
    vi.setSystemTime(new Date(2026, 9, 12, 21, 0, 0));
    await scheduleMorningBriefing([], [goal]);

    const notification = schedule.mock.calls[0][0].notifications[0];
    expect(notification.schedule.at.getDate()).toBe(13);
    expect(notification.largeBody).toContain('GATE 2027 · 79 days left');
  });

  it('reschedules when the content changes even if the delivery time does not', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 21, 0, 0));
    await scheduleMorningBriefing([], [goal]);
    await scheduleMorningBriefing([], [goal]);
    expect(schedule).toHaveBeenCalledTimes(1);

    await scheduleMorningBriefing([], [{ ...goal, endDate: '2026-12-01' }]);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('keeps the real streak when a settings change reschedules the briefing', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 21, 0, 0));
    await scheduleMorningBriefing([], [goal], 12, 20);
    await refreshMorningBriefing([], [goal]);

    const latest = schedule.mock.calls[schedule.mock.calls.length - 1][0].notifications[0];
    expect(latest.largeBody).toContain('12-day streak');
  });
});
