import { describe, expect, it } from 'vitest';
import type { TaskSession } from '../types';
import { formatAgo, lastSessionEnd, lastSessionNudge } from './lastSessionNudge';

const MIN = 60_000;
const HOUR = 60 * MIN;
const session = (id: string, endTime: number, extra: Partial<TaskSession> = {}): TaskSession => ({
  id, taskId: 't', startTime: endTime - 30 * MIN, endTime, pausedDuration: 0, pauses: [],
  netFocusMs: 30 * MIN, wallClockStart: '', wallClockEnd: '', completed: true, completedStepIndices: [], ...extra,
});

describe('lastSessionEnd', () => {
  it('finds the latest real session across tasks', () => {
    expect(lastSessionEnd({ a: [session('1', 1000 * MIN)], b: [session('2', 2000 * MIN)] })).toBe(2000 * MIN);
  });
  it('ignores manual ticks and runs under 15 seconds', () => {
    expect(lastSessionEnd({
      a: [session('1', 1000 * MIN), session('2', 3000 * MIN, { manual: true }), session('3', 4000 * MIN, { netFocusMs: 5000 })],
    })).toBe(1000 * MIN);
  });
  it('is null with no sessions', () => {
    expect(lastSessionEnd({})).toBeNull();
  });
});

describe('lastSessionNudge', () => {
  const now = 100_000 * MIN;
  it('stays quiet for a new user', () => {
    expect(lastSessionNudge(null, now)).toBeNull();
  });
  it('praises a short gap', () => {
    expect(lastSessionNudge(now - 45 * MIN, now)).toEqual({ tone: 'good', ago: '45 min ago', advice: 'Nice rhythm, keep it going.' });
  });
  it('nudges after a night or a long day', () => {
    expect(lastSessionNudge(now - 9 * HOUR, now)?.tone).toBe('ok');
    expect(lastSessionNudge(now - 9 * HOUR, now)).toMatchObject({ ago: '9h ago', advice: 'Start one soon to keep your rhythm.' });
  });
  it('warns about a long break', () => {
    expect(lastSessionNudge(now - 50 * HOUR, now)).toEqual({
      tone: 'long', ago: '2 days ago', advice: 'Long breaks break your rhythm. Start one today.',
    });
  });
});

describe('formatAgo', () => {
  it('reads naturally', () => {
    expect(formatAgo(20 * 1000)).toBe('1 min ago');
    expect(formatAgo(2 * HOUR + 15 * MIN)).toBe('2h 15m ago');
    expect(formatAgo(14 * HOUR + 15 * MIN)).toBe('14h ago');
    expect(formatAgo(25 * HOUR)).toBe('1 day ago');
  });
});
