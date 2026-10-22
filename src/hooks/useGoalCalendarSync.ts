import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  createDeviceEvent,
  deleteDeviceEvent,
  getDeviceCalendarPermission,
  getDeviceEvents,
  listDeviceCalendars,
  supportsDeviceCalendar,
  updateDeviceEvent,
} from '../lib/nativeCalendar';
import { CALENDAR_PREFS_CHANGED_EVENT, readGoalItemsToCalendar } from '../lib/calendarPrefs';
import {
  desiredGoalEvents,
  planGoalSync,
  readGoalLinks,
  writeGoalLinks,
  type GoalEventLink,
} from '../lib/goalCalendar';
import { chooseTaskCalendar, readTaskCalendarId } from '../lib/taskSchedule';
import { notifyCalendarChanged } from './useTaskCalendarSync';
import type { GoalNode } from '../types';

const LOOKUP_CHUNK = 200;
const DEBOUNCE_MS = 900;

/** Only the parts of the tree that decide what goes on the calendar. */
function goalSignature(goals: GoalNode[]): string {
  const parts: string[] = [];
  const visit = (node: GoalNode) => {
    parts.push([node.id, node.title, node.description ?? '', node.startDate ?? '', node.endDate ?? '', node.color ?? '', node.showAsEvent === undefined ? '' : node.showAsEvent ? 1 : 0, node.completed ? 1 : 0, node.children.length > 0 ? 1 : 0].join('\u0001'));
    node.children.forEach(visit);
  };
  goals.forEach(visit);
  return parts.join('\u0002');
}

/**
 * Puts open goal items that have dates on the phone calendar as all-day events (Android only, one way).
 * Finishing, deleting or undating an item removes its event; changing its title, details or dates rewrites
 * it. An event the user deleted on the phone stays deleted until the item itself changes. It runs when the
 * app opens, returns to the foreground, after the goal tree changes, and when the setting is switched.
 */
export function useGoalCalendarSync(goals: GoalNode[]) {
  const supported = supportsDeviceCalendar();
  const goalsRef = useRef(goals);
  goalsRef.current = goals;
  const running = useRef(false);
  const again = useRef(false);

  const runSync = useCallback(async () => {
    if (!supported) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        await syncPass(goalsRef.current);
      } while (again.current);
    } finally {
      running.current = false;
    }
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    const timer = window.setTimeout(() => void runSync(), 1800);
    const refresh = () => {
      if (document.visibilityState === 'visible') void runSync();
    };
    const prefs = () => void runSync();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(CALENDAR_PREFS_CHANGED_EVENT, prefs);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(CALENDAR_PREFS_CHANGED_EVENT, prefs);
    };
  }, [supported, runSync]);

  const signature = useMemo(() => goalSignature(goals), [goals]);
  useEffect(() => {
    if (!supported) return;
    const timer = window.setTimeout(() => void runSync(), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [supported, signature, runSync]);
}

async function syncPass(goals: GoalNode[]) {
  try {
    if ((await getDeviceCalendarPermission()) !== 'granted') return;
  } catch {
    return;
  }

  const desired = readGoalItemsToCalendar() ? desiredGoalEvents(goals) : [];
  const links = readGoalLinks();
  if (!desired.length && !Object.keys(links).length) return;

  // Which of the events YouDo made still exist on the phone.
  const live = Object.values(links).filter((link) => !link.removed);
  const existing = new Set<string>();
  try {
    const ids = [...new Set(live.map((link) => link.eventId))];
    for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
      for (const event of await getDeviceEvents(ids.slice(i, i + LOOKUP_CHUNK))) existing.add(event.id);
    }
  } catch {
    return;
  }

  const plan = planGoalSync(desired, links, existing);
  // Every event vanishing at once points to a calendar-wide problem, not the user deleting them one by one.
  const mostlyGone = live.length > 3 && plan.tombstone.length === live.length;
  if (mostlyGone) plan.tombstone = [];

  const next: Record<string, GoalEventLink> = { ...links };
  let changed = false;

  for (const { nodeId, link } of plan.tombstone) {
    next[nodeId] = { ...link, removed: true };
  }

  for (const { nodeId, link } of plan.remove) {
    if (link.removed) {
      delete next[nodeId];
      continue;
    }
    try {
      await deleteDeviceEvent(link.eventId);
      delete next[nodeId];
      changed = true;
    } catch {
      // Keep the link so the delete is tried again next time.
    }
  }

  for (const { want, link } of plan.update) {
    try {
      const updated = await updateDeviceEvent(link.eventId, {
        title: want.title,
        description: want.description,
        allDay: true,
        begin: want.begin,
        end: want.end,
        ...(want.color ? { color: want.color } : {}),
      });
      next[want.nodeId] = { ...link, title: want.title, description: want.description, begin: want.begin, end: want.end, color: want.color, removed: updated ? undefined : true };
      changed = changed || updated;
    } catch {
      // Left as it was; tried again next time.
    }
  }

  if (plan.create.length) {
    let calendarId: string | null = null;
    try {
      calendarId = chooseTaskCalendar(await listDeviceCalendars(), readTaskCalendarId())?.id ?? null;
    } catch {
      calendarId = null;
    }
    if (calendarId) {
      for (const want of plan.create) {
        try {
          const eventId = await createDeviceEvent({
            calendarId,
            title: want.title,
            description: want.description,
            allDay: true,
            begin: want.begin,
            end: want.end,
            ...(want.color ? { color: want.color } : {}),
          });
          next[want.nodeId] = { eventId, calendarId, title: want.title, description: want.description, begin: want.begin, end: want.end, color: want.color };
          changed = true;
        } catch {
          break; // Most likely the permission or calendar went away; try again next time.
        }
      }
    }
  }

  writeGoalLinks(next);
  if (changed) notifyCalendarChanged();
}
