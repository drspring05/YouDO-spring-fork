import type { TaskSession } from '../types';
import { isCountableSession, isManualSession } from './sessionStats';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Up to this gap the rhythm is intact. */
const GOOD_GAP_MS = 3 * HOUR;
/** From this gap the break is long enough to cost the rhythm (a night's sleep stays below it). */
const LONG_GAP_MS = DAY;

export interface LastSessionNudge {
  tone: 'good' | 'ok' | 'long';
  /** e.g. "2 days ago" */
  ago: string;
  /** A few words on what the gap means, e.g. "long break". */
  hint: string;
  /** Start to stop, pauses included. */
  lengthMs: number;
  /** Net focus ÷ length, 0–100. */
  efficiency: number;
}

/** The most recent real focus session (manual ticks and sub-15s runs don't count). */
export function lastSession(sessionHistory: Record<string, TaskSession[]>): TaskSession | null {
  let latest: TaskSession | null = null;
  for (const sessions of Object.values(sessionHistory)) {
    for (const s of sessions) {
      if (!isCountableSession(s) || isManualSession(s) || !Number.isFinite(s.endTime)) continue;
      if (latest === null || s.endTime > latest.endTime) latest = s;
    }
  }
  return latest;
}

export function formatAgo(gapMs: number): string {
  if (gapMs < HOUR) return `${Math.max(1, Math.floor(gapMs / MINUTE))} min ago`;
  if (gapMs < DAY) {
    const hours = Math.floor(gapMs / HOUR);
    const minutes = Math.floor((gapMs % HOUR) / MINUTE);
    return hours < 10 && minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(gapMs / DAY);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** Today at a glance: how long since the last session, how it went, and what the gap means. */
export function lastSessionNudge(session: TaskSession | null, now: number): LastSessionNudge | null {
  if (session === null) return null;
  const gap = Math.max(0, now - session.endTime);
  const lengthMs = Math.max(0, session.endTime - session.startTime);
  const efficiency = lengthMs > 0 ? Math.min(100, Math.max(0, Math.round((session.netFocusMs / lengthMs) * 100))) : 0;
  const base = { ago: formatAgo(gap), lengthMs, efficiency };
  if (gap < GOOD_GAP_MS) return { ...base, tone: 'good', hint: 'nice rhythm' };
  if (gap < LONG_GAP_MS) return { ...base, tone: 'ok', hint: 'start one soon' };
  return { ...base, tone: 'long', hint: 'long break' };
}
