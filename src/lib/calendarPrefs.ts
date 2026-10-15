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
