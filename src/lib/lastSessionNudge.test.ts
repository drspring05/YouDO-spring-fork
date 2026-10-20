import { describe, expect, it } from 'vitest';
import type { TaskSession } from '../types';
import { formatAgo, lastSession, lastSessionNudge } from './lastSessionNudge';

const MIN = 60_000;
const HOUR = 60 * MIN;
const session = (id: string, endTime: number, extra: Partial<TaskSession> = {}): TaskSession => ({
  id, taskId: 't', startTime: endTime - 50 * MIN, endTime, pausedDuration: 5 * MIN, pauses: [],
  netFocusMs: 45 * MIN, wallClockStart: '', wallClockEnd: '', completed: true, completedStepIndices: [], ...extra,
});

describe('lastSession', () => {
  it('finds the latest real session across tasks', () => {
    expect(lastSession({ a: [session('1', 1000 * MIN)], b: [session('2', 2000 * MIN)] })?.id).toBe('2');
  });
  it('ignores manual ticks and runs under 15 seconds', () => {
    expect(lastSession({
      a: [session('1', 1000 * MIN), session('2', 3000 * MIN, { manual: true }), session('3', 4000 * MIN, { netFocusMs: 5000 })],
    })?.id).toBe('1');
  });
  it('is null with no sessions', () => {
    expect(lastSession({})).toBeNull();
  });
});

describe('lastSessionNudge', () => {
  const now = 100_000 * MIN;
  it('stays quiet for a new user', () => {
    expect(lastSessionNudge(null, now)).toBeNull();
  });
  it('summarises the session: length and efficiency', () => {
    expect(lastSessionNudge(session('1', now - 45 * MIN), now)).toEqual({
      tone: 'good', ago: '45 min ago', hint: 'nice rhythm', lengthMs: 50 * MIN, efficiency: 90,
    });
  });
  it('nudges after a night or a long day', () => {
    expect(lastSessionNudge(session('1', now - 9 * HOUR), now)).toMatchObject({ tone: 'ok', ago: '9h ago', hint: 'start one soon' });
  });
  it('warns about a long break', () => {
    expect(lastSessionNudge(session('1', now - 50 * HOUR), now)).toMatchObject({ tone: 'long', ago: '2 days ago', hint: 'long break' });
  });
  it('keeps efficiency within 0–100', () => {
    expect(lastSessionNudge(session('1', now, { netFocusMs: 80 * MIN }), now)?.efficiency).toBe(100);
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
