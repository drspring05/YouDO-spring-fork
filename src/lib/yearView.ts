import { daysBetweenLocalISO, shiftLocalISO } from './dates';
import type { DeviceCalendarEvent } from './deviceCalendar';
import { compareLongestFirst } from './monthMerge';

/**
 * Year view: twelve small months, each day colored by the longest event that covers it
 * (no names, no dots). Pure helpers; the screen only draws what these return.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** One day cell of a small month. `date` is null for the blanks before the 1st and after the last day. */
export interface YearCell {
  date: string | null;
  /** day of the month, 0 for a blank */
  day: number;
}

export interface YearMonth {
  /** 0–11 */
  month: number;
  /** "YYYY-MM" */
  key: string;
  /** Sunday-first rows of seven; the last row is padded with blanks */
  cells: YearCell[];
}

export const yearStartDay = (year: number) => `${year}-01-01`;
export const yearEndDay = (year: number) => `${year}-12-31`;

/** The twelve months of a year, each laid out Sunday first. */
export function yearMonths(year: number): YearMonth[] {
  return Array.from({ length: 12 }, (_, month) => {
    const lead = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((lead + count) / 7) * 7;
    const cells: YearCell[] = [];
    for (let i = 0; i < total; i++) {
      const day = i - lead + 1;
      cells.push(day >= 1 && day <= count ? { date: `${year}-${pad(month + 1)}-${pad(day)}`, day } : { date: null, day: 0 });
    }
    return { month, key: `${year}-${pad(month + 1)}`, cells };
  });
}

/**
 * The color of the longest event on each day between `from` and `to` (inclusive). A day with no event is
 * left out. Ties between equally long events are settled the same way as in the Month view's merged blocks.
 */
export function dayColorsByLongestEvent(
  events: DeviceCalendarEvent[],
  from: string,
  to: string,
): Record<string, string> {
  const colors: Record<string, string> = {};
  const winners: Record<string, DeviceCalendarEvent> = {};
  for (const event of events) {
    const start = event.startDay < from ? from : event.startDay;
    const end = event.endDay > to ? to : event.endDay;
    if (start > end) continue;
    const length = daysBetweenLocalISO(start, end);
    let day = start;
    for (let i = 0; i <= length; i++) {
      const current = winners[day];
      if (!current || compareLongestFirst(event, current) < 0) {
        winners[day] = event;
        colors[day] = event.color;
      }
      day = shiftLocalISO(day, 1);
    }
  }
  return colors;
}
