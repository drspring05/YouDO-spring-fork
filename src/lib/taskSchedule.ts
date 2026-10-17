import { readStorageRaw } from './storageKeys';
import type { DeviceCalendar } from './nativeCalendar';
import type { Task } from '../types';

/** Local 24-hour "HH:mm", the format `<input type="time">` produces. */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isClockTime = (value: unknown): value is string => typeof value === 'string' && CLOCK.test(value);

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');

export interface ScheduleDraft {
  allDay: boolean;
  startTime: string;
  endTime: string;
}

/** Next full hour and one hour after it. Late evening starts at 22:00 so the end stays on the same day. */
export function defaultTimes(now: Date = new Date()): { startTime: string; endTime: string } {
  const startHour = Math.min(now.getHours() + 1, 22);
  return { startTime: `${pad(startHour)}:00`, endTime: `${pad(startHour + 1)}:00` };
}

/**
 * Plain-language problem with a timed schedule, or null when it is fine. All-day schedules are always fine.
 * `sameDay` is false when the schedule runs over several days, where the end time may be earlier on its own day.
 */
export function scheduleError(draft: ScheduleDraft, sameDay = true): string | null {
  if (draft.allDay) return null;
  if (!isClockTime(draft.startTime) || !isClockTime(draft.endTime)) return 'Pick a start and an end time.';
  if (sameDay && minutes(draft.endTime) <= minutes(draft.startTime)) return 'The end time must be after the start time.';
  return null;
}

/** The schedule fields to store on a task. A task with no date has no schedule. */
export function scheduleFields(
  targetDate: string | null,
  draft: ScheduleDraft,
): Pick<Task, 'allDay' | 'startTime' | 'endTime'> {
  if (!targetDate) return {};
  if (draft.allDay) return { allDay: true };
  return { allDay: false, startTime: draft.startTime, endTime: draft.endTime };
}

export interface EventWindow {
  allDay: boolean;
  /** epoch ms. All-day events use UTC midnights with an exclusive end, which is how Android stores them. */
  begin: number;
  end: number;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Start and end instants for a day plus schedule, or null when the date or times are unusable.
 * `endDate` is the last day of a timeframe (inclusive); missing, or not after `date`, means a single day.
 * The start time is on `date` and the end time on the last day.
 */
export function eventWindow(date: string, draft: ScheduleDraft, endDate: string = date): EventWindow | null {
  const first = DAY.exec(date);
  const lastDate = endDate > date ? endDate : date;
  const last = DAY.exec(lastDate);
  if (!first || !last || scheduleError(draft, lastDate === date)) return null;
  const [year, month, day] = [Number(first[1]), Number(first[2]), Number(first[3])];
  const [endYear, endMonth, endDay] = [Number(last[1]), Number(last[2]), Number(last[3])];
  if (draft.allDay) {
    const begin = Date.UTC(year, month - 1, day);
    return { allDay: true, begin, end: Date.UTC(endYear, endMonth - 1, endDay) + 86_400_000 };
  }
  const at = (y: number, m: number, d: number, time: string) =>
    new Date(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5))).getTime();
  return { allDay: false, begin: at(year, month, day, draft.startTime), end: at(endYear, endMonth, endDay, draft.endTime) };
}

/** Which calendar new task events go to, remembered per phone. */
export const TASK_CALENDAR_KEY = 'youdo-task-calendar-v1';

export function readTaskCalendarId(): string | null {
  try {
    const raw = readStorageRaw(TASK_CALENDAR_KEY);
    const value = raw === null ? null : JSON.parse(raw);
    return typeof value === 'string' && value ? value : null;
  } catch {
    return null;
  }
}

export function writeTaskCalendarId(id: string): void {
  try {
    localStorage.setItem(TASK_CALENDAR_KEY, JSON.stringify(id));
  } catch {
    /* the choice just won't be remembered */
  }
}

export const writableCalendars = (calendars: DeviceCalendar[]) => calendars.filter((calendar) => calendar.writable);

/**
 * The calendar a new task event goes to: the remembered one if it is still there and writable, otherwise
 * the account's main calendar (its name is the account address), otherwise the first writable one.
 */
export function chooseTaskCalendar(calendars: DeviceCalendar[], savedId: string | null): DeviceCalendar | null {
  const writable = writableCalendars(calendars);
  return (
    writable.find((calendar) => calendar.id === savedId) ??
    writable.find((calendar) => calendar.name === calendar.accountName) ??
    writable[0] ??
    null
  );
}
