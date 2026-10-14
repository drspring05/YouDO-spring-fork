import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() } }));

import {
  FOCUS_STATUS_MAX_AGE_MS,
  focusElapsedMs,
  focusShareFromSession,
  focusShareKey,
  isLiveFocus,
  type FocusStatus,
} from './focusStatus';
import type { ActiveSession } from '../types';
import { formatClock } from '../components/hub/hubTime';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const MIN = 60_000;

function session(over: Partial<ActiveSession> = {}): ActiveSession {
  return {
    taskId: 't1',
    startTime: NOW - 30 * MIN,
    pausedDuration: 0,
    isPaused: false,
    lastHeartbeat: NOW,
    pauses: [],
    wallClockStart: '11:30',
    ...over,
  };
}

function status(over: Partial<FocusStatus> = {}): FocusStatus {
  return {
    userId: 'u1',
    state: 'focusing',
    startedAt: new Date(NOW - 30 * MIN).toISOString(),
    pausedMs: 0,
    updatedAt: new Date(NOW - 30 * MIN).toISOString(),
    ...over,
  };
}

describe('what a session shares with room-mates', () => {
  it('shares idle without a session, never a task', () => {
    expect(focusShareFromSession(null)).toEqual({ state: 'idle', startedAt: null, pausedMs: 0 });
    expect(JSON.stringify(focusShareFromSession(session()))).not.toContain('t1');
  });

  it('shares focusing and paused with the start time', () => {
    expect(focusShareFromSession(session()).state).toBe('focusing');
    expect(focusShareFromSession(session({ isPaused: true })).state).toBe('paused');
    expect(focusShareFromSession(session()).startedAt).toBe(new Date(NOW - 30 * MIN).toISOString());
  });

  it('only changes its key on start, pause, resume or stop — not on heartbeats', () => {
    const base = focusShareKey(focusShareFromSession(session()));
    expect(focusShareKey(focusShareFromSession(session({ lastHeartbeat: NOW + 30_000 })))).toBe(base);
    expect(focusShareKey(focusShareFromSession(session({ pausedDuration: 400 })))).toBe(base);
    expect(focusShareKey(focusShareFromSession(session({ isPaused: true })))).not.toBe(base);
    expect(focusShareKey(focusShareFromSession(session({ pausedDuration: 5 * MIN })))).not.toBe(base);
    expect(focusShareKey(focusShareFromSession(null))).not.toBe(base);
  });
});

describe('reading a room-mate’s focus', () => {
  it('counts focused time without pauses', () => {
    expect(focusElapsedMs(status({ pausedMs: 5 * MIN }), NOW)).toBe(25 * MIN);
  });

  it('stops the clock where the pause began', () => {
    const paused = status({ state: 'paused', pausedMs: 0, updatedAt: new Date(NOW - 10 * MIN).toISOString() });
    expect(focusElapsedMs(paused, NOW)).toBe(20 * MIN);
    expect(focusElapsedMs(paused, NOW + 60 * MIN)).toBe(20 * MIN);
  });

  it('treats idle and stale sessions as not live', () => {
    expect(focusElapsedMs(status({ state: 'idle', startedAt: null }), NOW)).toBe(0);
    expect(isLiveFocus(status(), NOW)).toBe(true);
    expect(isLiveFocus(status({ state: 'idle' }), NOW)).toBe(false);
    expect(isLiveFocus(status({ startedAt: new Date(NOW - FOCUS_STATUS_MAX_AGE_MS - MIN).toISOString() }), NOW)).toBe(false);
  });

  it('formats the live clock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(24 * MIN + 2_000)).toBe('24:02');
    expect(formatClock(102 * MIN + 7_000)).toBe('1:42:07');
  });
});
