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
  advice: string;
}

/** When the most recent real focus session ended (manual ticks and sub-15s runs don't count). */
export function lastSessionEnd(sessionHistory: Record<string, TaskSession[]>): number | null {
  let latest: number | null = null;
  for (const sessions of Object.values(sessionHistory)) {
    for (const s of sessions) {
      if (!isCountableSession(s) || isManualSession(s) || !Number.isFinite(s.endTime)) continue;
      if (latest === null || s.endTime > latest) latest = s.endTime;
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

/** A gentle line for Today at a glance: how long since the last session, and what to do about it. */
export function lastSessionNudge(lastEnd: number | null, now: number): LastSessionNudge | null {
  if (lastEnd === null) return null;
  const gap = Math.max(0, now - lastEnd);
  const ago = formatAgo(gap);
  if (gap < GOOD_GAP_MS) return { tone: 'good', ago, advice: 'Nice rhythm, keep it going.' };
  if (gap < LONG_GAP_MS) return { tone: 'ok', ago, advice: 'Start one soon to keep your rhythm.' };
  return { tone: 'long', ago, advice: 'Long breaks break your rhythm. Start a short session today.' };
}
