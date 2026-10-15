import type { DeviceCalendarEvent } from './deviceCalendar';

/** How many event bars one week row shows before the rest collapse into a "+N" count. */
export const MAX_BAR_LANES = 3;

/** One event drawn as a bar across part of a week row (columns 0–6, Sunday first). */
export interface WeekBar {
  event: DeviceCalendarEvent;
  startCol: number;
  endCol: number;
  lane: number;
  /** the event started in an earlier week */
  continuesBefore: boolean;
  /** the event carries on into the next week */
  continuesAfter: boolean;
}

export interface WeekLayout {
  /** the seven local days of the row, YYYY-MM-DD */
  days: string[];
  bars: WeekBar[];
  /** per column: events that did not fit in the visible lanes */
  hidden: number[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Every day shown by a month grid: whole weeks, Sunday first, padded with the neighbouring months. */
export function monthGridDays(year: number, month: number): string[] {
  const lead = new Date(year, month, 1).getDay();
  const inMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((lead + inMonth) / 7) * 7;
  const days: string[] = [];
  for (let i = 0; i < total; i++) days.push(isoOf(new Date(year, month, 1 - lead + i)));
  return days;
}

export function chunkWeeks(days: string[]): string[][] {
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * Places the events that touch one week row into stacked lanes, like the bars in a printed calendar.
 * Longer and all-day events go first so they keep a steady lane; whatever does not fit is counted per day.
 */
export function layoutWeek(days: string[], events: DeviceCalendarEvent[], maxLanes = MAX_BAR_LANES): WeekLayout {
  const first = days[0];
  const last = days[days.length - 1];
  const lastCol = days.length - 1;

  const segments = events
    .filter((event) => event.startDay <= last && event.endDay >= first)
    .map((event) => {
      const startCol = event.startDay <= first ? 0 : days.indexOf(event.startDay);
      const endCol = event.endDay >= last ? lastCol : days.indexOf(event.endDay);
      return { event, startCol, endCol };
    })
    .filter((segment) => segment.startCol >= 0 && segment.endCol >= segment.startCol)
    .sort(
      (a, b) =>
        a.startCol - b.startCol ||
        b.endCol - b.startCol - (a.endCol - a.startCol) ||
        Number(b.event.allDay) - Number(a.event.allDay) ||
        a.event.begin - b.event.begin ||
        a.event.title.localeCompare(b.event.title),
    );

  const laneEnds: number[] = [];
  const bars: WeekBar[] = [];
  const hidden = days.map(() => 0);

  for (const { event, startCol, endCol } of segments) {
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) lane = laneEnds.length;
    if (lane >= maxLanes) {
      for (let col = startCol; col <= endCol; col++) hidden[col] += 1;
      continue;
    }
    laneEnds[lane] = endCol;
    bars.push({
      event,
      startCol,
      endCol,
      lane,
      continuesBefore: event.startDay < first,
      continuesAfter: event.endDay > last,
    });
  }

  return { days, bars, hidden };
}

/** Black or white, whichever reads better on a calendar's own color. */
export function readableTextColor(hex: string): '#111111' | '#ffffff' {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return '#ffffff';
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
}
