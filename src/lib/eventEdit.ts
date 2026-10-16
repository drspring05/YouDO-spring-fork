import { localISODate } from './dates';
import type { DeviceCalendarEvent } from './deviceCalendar';
import type { DeviceEventChanges, NewDeviceEvent } from './nativeCalendar';
import { defaultTimes } from './taskSchedule';

/**
 * The form behind the event editor in the Calendar tab: turning a phone-calendar event into form fields,
 * checking them, and working out which fields actually changed.
 */

const DAY_MS = 86_400_000;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface EventDraft {
  title: string;
  description: string;
  allDay: boolean;
  /** local day, YYYY-MM-DD. For an all-day event this is its first day. */
  startDate: string;
  /** local day, YYYY-MM-DD, inclusive. For an all-day event this is its last day. */
  endDate: string;
  /** local 24-hour "HH:mm". Only used when the event is not all-day. */
  startTime: string;
  /** local 24-hour "HH:mm". Only used when the event is not all-day. */
  endTime: string;
}

export interface EventSchedule {
  allDay: boolean;
  /** epoch ms. All-day events use UTC midnights with an exclusive end, which is how Android stores them. */
  begin: number;
  end: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const clockOf = (ms: number) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const parseDay = (iso: string): [number, number, number] | null => {
  const match = DAY.exec(iso);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

const localMoment = (iso: string, time: string): number | null => {
  const day = parseDay(iso);
  if (!day || !CLOCK.test(time)) return null;
  return new Date(day[0], day[1] - 1, day[2], Number(time.slice(0, 2)), Number(time.slice(3, 5))).getTime();
};

/** An empty form for a new event on `date`: all-day, with sensible times ready if the user turns that off. */
export function newDraft(date: string, now: Date = new Date()): EventDraft {
  return { title: '', description: '', allDay: true, startDate: date, endDate: date, ...defaultTimes(now) };
}

/** The form fields for an existing event. */
export function draftFromEvent(event: DeviceCalendarEvent): EventDraft {
  const times = defaultTimes();
  const base = { title: event.title, description: event.description, ...times };
  if (event.allDay) {
    const lastDay = utcDay(Math.max(event.begin, event.end - DAY_MS));
    return { ...base, allDay: true, startDate: utcDay(event.begin), endDate: lastDay };
  }
  return {
    ...base,
    allDay: false,
    startDate: localISODate(new Date(event.begin)),
    endDate: localISODate(new Date(event.end)),
    startTime: clockOf(event.begin),
    endTime: clockOf(event.end),
  };
}

/** The event's schedule can be changed from the app: not for repeating events, and not on read-only calendars. */
export const canEditSchedule = (event: DeviceCalendarEvent) => event.writable && !event.recurring;

/** The schedule the form describes, or null while its dates or times are unusable or out of order. */
export function draftSchedule(draft: EventDraft): EventSchedule | null {
  const start = parseDay(draft.startDate);
  const end = parseDay(draft.endDate);
  if (!start || !end) return null;
  if (draft.allDay) {
    const begin = Date.UTC(start[0], start[1] - 1, start[2]);
    const last = Date.UTC(end[0], end[1] - 1, end[2]);
    return last >= begin ? { allDay: true, begin, end: last + DAY_MS } : null;
  }
  const begin = localMoment(draft.startDate, draft.startTime);
  const end2 = localMoment(draft.endDate, draft.endTime);
  return begin !== null && end2 !== null && end2 > begin ? { allDay: false, begin, end: end2 } : null;
}

/** Plain-language problem with the form, or null when it can be saved. */
export function draftError(draft: EventDraft, checkSchedule = true): string | null {
  if (!draft.title.trim()) return 'Give the event a title.';
  if (!checkSchedule) return null;
  if (!parseDay(draft.startDate) || !parseDay(draft.endDate)) return 'Pick a date.';
  if (draft.allDay) return draftSchedule(draft) ? null : 'The end date can’t be before the start date.';
  if (!CLOCK.test(draft.startTime) || !CLOCK.test(draft.endTime)) return 'Pick a start and an end time.';
  return draftSchedule(draft) ? null : 'The end must be after the start.';
}

/** What the phone calendar needs to create the event, or null when the form is not valid. */
export function toNewEvent(draft: EventDraft, calendarId: string): NewDeviceEvent | null {
  const schedule = draftSchedule(draft);
  if (!schedule || draftError(draft)) return null;
  return {
    calendarId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    ...schedule,
  };
}

/**
 * Only the fields that differ from the event, ready for the phone calendar. The schedule is included
 * (all three of allDay, begin and end together) only when `editSchedule` is true and it really changed.
 * Empty when nothing changed.
 */
export function toChanges(event: DeviceCalendarEvent, draft: EventDraft, editSchedule: boolean): DeviceEventChanges {
  const changes: DeviceEventChanges = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (title !== event.title.trim()) changes.title = title;
  if (description !== event.description.trim()) changes.description = description;
  if (editSchedule) {
    const schedule = draftSchedule(draft);
    if (schedule && (schedule.allDay !== event.allDay || schedule.begin !== event.begin || schedule.end !== event.end)) {
      changes.allDay = schedule.allDay;
      changes.begin = schedule.begin;
      changes.end = schedule.end;
    }
  }
  return changes;
}
