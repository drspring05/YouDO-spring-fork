import { readStorageRaw } from './storageKeys';

/** The ways the Calendar tab can be laid out. Year joins this list when that view is built. */
export type CalendarViewMode = 'month' | 'week' | 'agenda';

export const CALENDAR_VIEW_OPTIONS: { id: CalendarViewMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'agenda', label: 'Agenda' },
];

/** Which view the Calendar tab opens in. Saved on this device only, like the other look-and-feel choices. */
export const CALENDAR_DEFAULT_VIEW_KEY = 'youdo-calendar-default-view-v1';

export function normalizeCalendarView(value: unknown): CalendarViewMode {
  return CALENDAR_VIEW_OPTIONS.some((option) => option.id === value) ? (value as CalendarViewMode) : 'month';
}

/** Anything missing, unreadable or no longer offered falls back to Month. */
export function readCalendarDefaultView(): CalendarViewMode {
  try {
    const raw = readStorageRaw(CALENDAR_DEFAULT_VIEW_KEY);
    return raw === null ? 'month' : normalizeCalendarView(JSON.parse(raw));
  } catch {
    return 'month';
  }
}

/* ─── What goes onto the phone calendar ───────────────────────────────────── */

/** Tasks planned from the Goals tab get a phone-calendar event. On unless switched off. */
export const CALENDAR_PLANNED_TASKS_KEY = 'youdo-calendar-planned-tasks-v1';
/** Goal items that have a start and/or end date appear on the phone calendar. On unless switched off. */
export const CALENDAR_GOAL_ITEMS_KEY = 'youdo-calendar-goal-items-v1';
/** Fired when either choice above changes, so the app applies it right away. */
export const CALENDAR_PREFS_CHANGED_EVENT = 'youdo-calendar-prefs-changed';

function readFlag(key: string): boolean {
  try {
    const raw = readStorageRaw(key);
    return raw === null ? true : JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

export const readPlannedTasksToCalendar = () => readFlag(CALENDAR_PLANNED_TASKS_KEY);
export const readGoalItemsToCalendar = () => readFlag(CALENDAR_GOAL_ITEMS_KEY);

/* ─── Which phone calendars the Calendar tab shows ────────────────────────── */

/** Ids of phone calendars switched off for the Calendar tab. Everything else is shown. Saved on this device only. */
export const CALENDAR_HIDDEN_KEY = 'youdo-calendar-hidden-v1';

/** Keeps only non-empty text ids, once each; anything else in storage is dropped. */
export function normalizeHiddenCalendars(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export function readHiddenCalendarIds(): string[] {
  try {
    const raw = readStorageRaw(CALENDAR_HIDDEN_KEY);
    return raw === null ? [] : normalizeHiddenCalendars(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Saves the list and tells the Calendar tab straight away. */
export function writeHiddenCalendarIds(ids: string[]): void {
  try {
    localStorage.setItem(CALENDAR_HIDDEN_KEY, JSON.stringify(normalizeHiddenCalendars(ids)));
  } catch {
    /* the choice just won't be remembered */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CALENDAR_PREFS_CHANGED_EVENT));
}
