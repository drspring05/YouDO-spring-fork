import { formatDateLabel, readDateFormat } from './dateFormat';
import { localISODate } from './dates';

/** Notes for the Week view, one text per week. Saved on this device only. */
export const WEEK_NOTES_KEY = 'youdo-calendar-week-notes-v1';

/** Longest note kept per week, so a runaway paste cannot fill local storage. */
export const WEEK_NOTE_MAX_LENGTH = 4000;

/** Items one day cell lists before the rest collapse into a "+N more" line underneath. */
export const WEEK_CELL_MAX_ITEMS = 5;

/** One cell of the 2×4 week grid: a day, or the notes cell that closes the grid. */
export type WeekCell =
  | { kind: 'day'; date: string; weekdayIndex: number }
  | { kind: 'notes'; weekStart: string };

const parseLocalDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The Sunday that starts the week containing `iso` (the month grid is Sunday-first too). */
export function weekStartOf(iso: string): string {
  const date = parseLocalDay(iso);
  date.setDate(date.getDate() - date.getDay());
  return localISODate(date);
}

/** The seven local days of the week containing `iso`, Sunday first. */
export function weekDaysOf(iso: string): string[] {
  const start = parseLocalDay(weekStartOf(iso));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return localISODate(day);
  });
}

/**
 * The 2×4 grid, filled top-down column by column:
 * first column Sun, Mon, Tue, Wed; second column Thu, Fri, Sat, Notes.
 */
export function weekCells(iso: string): WeekCell[] {
  const days = weekDaysOf(iso);
  return [
    ...days.map((date, weekdayIndex): WeekCell => ({ kind: 'day', date, weekdayIndex })),
    { kind: 'notes', weekStart: days[0] },
  ];
}

/** "Oct 11 – 17, 2026", "Oct 25 – Nov 1, 2026" or "Dec 27, 2026 – Jan 2, 2027". */
export function weekRangeLabel(days: string[]): string {
  if (days.length === 0) return '';
  const first = parseLocalDay(days[0]);
  const last = parseLocalDay(days[days.length - 1]);
  const order = readDateFormat();
  const short = (d: Date) => (order === 'auto' ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : formatDateLabel(d, 'short', order));
  if (first.getFullYear() !== last.getFullYear()) {
    const full = (d: Date) => (order === 'auto' ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : `${formatDateLabel(d, 'short', order)} ${d.getFullYear()}`);
    return `${full(first)} – ${full(last)}`;
  }
  if (order === 'dmy' && first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${short(last)}, ${last.getFullYear()}`;
  }
  const sameMonth = first.getMonth() === last.getMonth();
  const tail = sameMonth && order !== 'ymd' ? String(last.getDate()) : short(last);
  return `${short(first)} – ${tail}, ${last.getFullYear()}`;
}

/** Keeps only well-formed `{ 'YYYY-MM-DD': 'text' }` entries; anything else in storage is dropped. */
export function normalizeWeekNotes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const notes: Record<string, string> = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof text === 'string' && text.length > 0) {
      notes[key] = text.slice(0, WEEK_NOTE_MAX_LENGTH);
    }
  }
  return notes;
}

/** Returns a new notes map with one week's text set; an empty text removes that week's entry. */
export function withWeekNote(notes: Record<string, string>, weekStart: string, text: string): Record<string, string> {
  const next = { ...notes };
  const clipped = text.slice(0, WEEK_NOTE_MAX_LENGTH);
  if (clipped.length === 0) delete next[weekStart];
  else next[weekStart] = clipped;
  return next;
}
