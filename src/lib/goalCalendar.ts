import { normalizeHex } from './eventColors';
import { readStorageRaw } from './storageKeys';
import type { GoalNode } from '../types';

/**
 * Goal items with dates, shown on the phone calendar as all-day events (one way: YouDo to calendar).
 * Only open items with nothing inside them count (not goals or branches that hold other items):
 * finishing an item, deleting it, clearing its dates, or adding items inside it removes its event.
 */

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** What one goal item should look like on the calendar. */
export interface DesiredGoalEvent {
  nodeId: string;
  title: string;
  description: string;
  /** all-day, UTC midnights with an exclusive end, like every all-day event here */
  begin: number;
  end: number;
  /** "#RRGGBB" chosen for the item. Missing means the calendar's own color. */
  color?: string;
}

/** What YouDo last put on the calendar for one goal item. */
export interface GoalEventLink {
  eventId: string;
  calendarId: string;
  title: string;
  description: string;
  begin: number;
  end: number;
  color?: string;
  /** The event was deleted on the phone. It stays deleted until the item's dates or text change. */
  removed?: boolean;
}

const utcMidnight = (iso: unknown): number | null => {
  if (typeof iso !== 'string') return null;
  const match = ISO_DAY.exec(iso);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(ms) ? ms : null;
};

/**
 * The days an item covers: start to end, inclusive. With one date it is that single day.
 * An end before the start is treated as just the start day. Null when there is no usable date.
 */
export function goalEventWindow(node: Pick<GoalNode, 'startDate' | 'endDate'>): { begin: number; end: number } | null {
  const start = utcMidnight(node.startDate);
  const end = utcMidnight(node.endDate);
  const first = start ?? end;
  if (first === null) return null;
  const last = start !== null && end !== null ? Math.max(start, end) : first;
  return { begin: first, end: last + DAY_MS };
}

/**
 * Every open goal item that has a date, in tree order. Only the lowest items (the ones with nothing
 * inside them) are listed: a goal or branch that holds other items would otherwise show up as one huge
 * bar that covers the whole calendar. Its dates are still kept in the goal tree, just not sent to the calendar.
 */
export function desiredGoalEvents(goals: GoalNode[]): DesiredGoalEvent[] {
  const out: DesiredGoalEvent[] = [];
  const visit = (node: GoalNode) => {
    if (!node.completed && node.children.length === 0) {
      const window = goalEventWindow(node);
      const title = (node.title ?? '').trim();
      const color = normalizeHex(node.color);
      if (window && title) {
        out.push({ nodeId: node.id, title, description: (node.description ?? '').trim(), ...window, ...(color ? { color } : {}) });
      }
    }
    node.children.forEach(visit);
  };
  goals.forEach(visit);
  return out;
}

export interface GoalSyncPlan {
  create: DesiredGoalEvent[];
  /** The item changed since its event was written; rewrite the event. */
  update: { want: DesiredGoalEvent; link: GoalEventLink }[];
  /** The item is done, deleted or undated; take its event off the calendar. */
  remove: { nodeId: string; link: GoalEventLink }[];
  /** The item's event was deleted on the phone, so remember that and leave it deleted. */
  tombstone: { nodeId: string; link: GoalEventLink }[];
}

const sameAsLink = (want: DesiredGoalEvent, link: GoalEventLink) =>
  want.title === link.title &&
  want.description === link.description &&
  want.begin === link.begin &&
  want.end === link.end &&
  (want.color ?? '') === (link.color ?? '');

/**
 * Compares what the goal tree wants with what was written last time. `existing` is the set of event ids
 * that still exist on the phone. An item whose event was edited on the phone is left alone until the
 * item itself changes, so phone-side edits are not overwritten.
 */
export function planGoalSync(
  desired: DesiredGoalEvent[],
  links: Record<string, GoalEventLink>,
  existing: Set<string>,
): GoalSyncPlan {
  const plan: GoalSyncPlan = { create: [], update: [], remove: [], tombstone: [] };
  const wanted = new Set<string>();
  for (const want of desired) {
    wanted.add(want.nodeId);
    const link = links[want.nodeId];
    if (!link) {
      plan.create.push(want);
    } else if (link.removed) {
      // Deleted on the phone: only a change to the item brings it back.
      if (!sameAsLink(want, link)) plan.create.push(want);
    } else if (!existing.has(link.eventId)) {
      plan.tombstone.push({ nodeId: want.nodeId, link });
    } else if (!sameAsLink(want, link)) {
      plan.update.push({ want, link });
    }
  }
  for (const [nodeId, link] of Object.entries(links)) {
    if (!wanted.has(nodeId)) plan.remove.push({ nodeId, link });
  }
  return plan;
}

/* ─── Per-phone storage ──────────────────────────────────────────────────── */

export const GOAL_LINKS_KEY = 'youdo-goal-calendar-links-v1';

export function readGoalLinks(): Record<string, GoalEventLink> {
  try {
    const raw = readStorageRaw(GOAL_LINKS_KEY);
    const value = raw === null ? {} : JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, GoalEventLink>) : {};
  } catch {
    return {};
  }
}

export function writeGoalLinks(links: Record<string, GoalEventLink>) {
  try {
    localStorage.setItem(GOAL_LINKS_KEY, JSON.stringify(links));
  } catch {
    /* worst case the events are looked at again next time */
  }
}
