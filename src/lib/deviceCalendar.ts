import { localISODate, shiftLocalISO } from './dates';
import type { RawDeviceEvent } from './nativeCalendar';

/** A phone-calendar event with the local days it covers worked out. */
export interface DeviceCalendarEvent extends RawDeviceEvent {
  /** unique per occurrence (repeating events share an `id`) */
  key: string;
  /** first local day, YYYY-MM-DD */
  startDay: string;
  /** last local day, YYYY-MM-DD, inclusive */
  endDay: string;
}

const FALLBACK_COLOR = '#8B8B8B';
/** Stops one runaway event (for example a 10-year block) from filling the grid map. */
const MAX_SPAN_DAYS = 62;

const safeColor = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : FALLBACK_COLOR;

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Returns null for rows that are unusable, so one bad event never breaks the calendar. */
export function toDeviceEvent(raw: RawDeviceEvent): DeviceCalendarEvent | null {
  if (!raw || typeof raw.id !== 'string' || !Number.isFinite(raw.begin) || !Number.isFinite(raw.end)) return null;
  const lastMs = Math.max(raw.begin, raw.end - 1);
  // All-day events are stored as UTC midnights; everything else is a real instant in local time.
  const startDay = raw.allDay ? utcDay(raw.begin) : localISODate(new Date(raw.begin));
  const endDay = raw.allDay ? utcDay(lastMs) : localISODate(new Date(lastMs));
  return {
    ...raw,
    title: typeof raw.title === 'string' ? raw.title : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    location: typeof raw.location === 'string' ? raw.location : '',
    color: safeColor(raw.color),
    key: `${raw.id}:${raw.begin}`,
    startDay,
    endDay,
  };
}

export function toDeviceEvents(rows: RawDeviceEvent[]): DeviceCalendarEvent[] {
  return rows.flatMap((row) => {
    const event = toDeviceEvent(row);
    return event ? [event] : [];
  });
}

/** All-day first, then by start time, then title. */
export function compareDeviceEvents(a: DeviceCalendarEvent, b: DeviceCalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.begin - b.begin || a.title.localeCompare(b.title);
}

export function groupDeviceEventsByDay(events: DeviceCalendarEvent[]): Record<string, DeviceCalendarEvent[]> {
  const byDay: Record<string, DeviceCalendarEvent[]> = {};
  for (const event of events) {
    let day = event.startDay;
    for (let i = 0; i < MAX_SPAN_DAYS && day <= event.endDay; i++) {
      (byDay[day] ??= []).push(event);
      day = shiftLocalISO(day, 1);
    }
  }
  for (const list of Object.values(byDay)) list.sort(compareDeviceEvents);
  return byDay;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Label for one event as it appears on `date`. */
export function eventTimeLabel(event: DeviceCalendarEvent, date: string): string {
  if (event.allDay) return 'All day';
  const startsToday = event.startDay === date;
  const endsToday = event.endDay === date;
  if (startsToday && endsToday) return event.end > event.begin ? `${clock(event.begin)} – ${clock(event.end)}` : clock(event.begin);
  if (startsToday) return `From ${clock(event.begin)}`;
  if (endsToday) return `Until ${clock(event.end)}`;
  return 'All day';
}

/**
 * Epoch-ms window for a run of local days. Padded by a day each side so all-day events (stored on UTC
 * midnights) are never missed by users west of UTC; the grouping step then keeps only the right days.
 */
export function queryWindow(startDate: string, endDate: string): { start: number; end: number } {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd - 1).getTime();
  const end = new Date(ey, em - 1, ed + 2).getTime();
  return { start, end };
}
