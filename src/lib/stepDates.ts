import type { GoalNode, Task } from '../types';
import { daysBetweenLocalISO, shiftLocalISO } from './dates';

/**
 * Per-step dates. A lowest-level goal item can give each of its steps its own day inside the item's timeframe
 * (the Plan sheet's month and day wheels). The dates live on the goal item as `stepDates`, a list that runs
 * parallel to `steps`: an entry is a "YYYY-MM-DD" day, or null/missing when the step has no day of its own
 * and simply follows the task.
 */

/** The first and last day a task covers, both inclusive. A one-day task has start === end. */
export interface DayRange {
  start: string;
  end: string;
}

/** One month the wheel can show. `month` is 0-11. */
export interface WheelMonth {
  year: number;
  month: number;
}

/** The most months a wheel offers, so a runaway end date cannot build an enormous list. */
export const MAX_WHEEL_MONTHS = 36;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day written "YYYY-MM-DD". */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DAY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

/** The days a task covers. A missing, equal or earlier end means a single day. */
export function dayRange(start: string, end?: string | null): DayRange {
  return { start, end: end && end > start ? end : start };
}

export function isSingleDay(range: DayRange): boolean {
  return range.start === range.end;
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** True when `iso` is a real day inside the range. */
export function inDayRange(iso: unknown, range: DayRange): iso is string {
  return isIsoDay(iso) && iso >= range.start && iso <= range.end;
}

/** Every month the range touches, in order. */
export function monthsInRange(range: DayRange): WheelMonth[] {
  const [sy, sm] = range.start.split('-').map(Number);
  const [ey, em] = range.end.split('-').map(Number);
  const months: WheelMonth[] = [];
  let year = sy;
  let month = sm - 1;
  while ((year < ey || (year === ey && month <= em - 1)) && months.length < MAX_WHEEL_MONTHS) {
    months.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

/** The day numbers of one month that fall inside the range. */
export function daysInRangeForMonth(range: DayRange, year: number, month: number): number[] {
  const last = new Date(year, month + 1, 0).getDate();
  const days: number[] = [];
  for (let day = 1; day <= last; day += 1) {
    if (inDayRange(isoFromParts(year, month, day), range)) days.push(day);
  }
  return days;
}

/** The month and day of a date, or null when it is not a day inside the range. */
export function partsOf(iso: string | null | undefined, range: DayRange): { year: number; month: number; day: number } | null {
  if (!inDayRange(iso, range)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month: month - 1, day };
}

/**
 * What the wheels show for a step: the chosen month and day, as positions in their lists.
 * Position 0 of each wheel is a "—" placeholder, so a real month or day sits at its list index plus one.
 */
export function wheelPositions(
  current: string | null | undefined,
  range: DayRange,
): { monthPos: number; dayPos: number; months: WheelMonth[]; days: number[] } {
  const months = monthsInRange(range);
  const parts = partsOf(current, range);
  if (!parts) {
    const first = months[0];
    return { monthPos: 0, dayPos: 0, months, days: first ? daysInRangeForMonth(range, first.year, first.month) : [] };
  }
  const monthIndex = months.findIndex((m) => m.year === parts.year && m.month === parts.month);
  const days = daysInRangeForMonth(range, parts.year, parts.month);
  return { monthPos: monthIndex + 1, dayPos: days.indexOf(parts.day) + 1, months, days };
}

/**
 * The new date after the person scrolls one of the wheels. Returns null when the step should have no day
 * of its own (the day wheel went back to "—", or the month wheel did).
 * - Month wheel: moving to a month keeps the same day number when that month has it inside the range,
 *   otherwise the day inside the range that is closest in time to the date the step had.
 * - Day wheel: sets the day inside the month already chosen (the first month if none is chosen yet).
 */
export function stepDateAfterWheel(
  current: string | null | undefined,
  range: DayRange,
  wheel: 'month' | 'day',
  position: number,
): string | null {
  if (position <= 0) return null;
  const months = monthsInRange(range);
  if (months.length === 0) return null;
  const parts = partsOf(current, range);

  if (wheel === 'month') {
    const target = months[Math.min(position - 1, months.length - 1)];
    const days = daysInRangeForMonth(range, target.year, target.month);
    if (days.length === 0) return null;
    if (!parts) return isoFromParts(target.year, target.month, days[0]);
    if (days.includes(parts.day)) return isoFromParts(target.year, target.month, parts.day);
    const from = isoFromParts(parts.year, parts.month, parts.day);
    const distance = (d: number) => Math.abs(daysBetweenLocalISO(from, isoFromParts(target.year, target.month, d)));
    const day = days.reduce((best, d) => (distance(d) < distance(best) ? d : best), days[0]);
    return isoFromParts(target.year, target.month, day);
  }

  const month = parts ? { year: parts.year, month: parts.month } : months[0];
  const days = daysInRangeForMonth(range, month.year, month.month);
  const day = days[Math.min(position - 1, days.length - 1)];
  return day === undefined ? null : isoFromParts(month.year, month.month, day);
}

/** Reads a stored list: keeps real days only and pads or trims it to the number of steps. Undefined when no step has a day. */
export function normalizeStepDates(raw: unknown, stepCount: number): (string | null)[] | undefined {
  if (!Array.isArray(raw) || stepCount <= 0) return undefined;
  const dates = Array.from({ length: stepCount }, (_, i) => (isIsoDay(raw[i]) ? (raw[i] as string) : null));
  return dates.some(Boolean) ? dates : undefined;
}

/** `stepDates` of a goal item, one entry per step; entries that are not real days are null. */
export function nodeStepDates(node: Pick<GoalNode, 'steps' | 'stepDates'> | null | undefined): (string | null)[] {
  const steps = node?.steps ?? [];
  return steps.map((_, i) => (isIsoDay(node?.stepDates?.[i]) ? (node!.stepDates![i] as string) : null));
}

/**
 * The dates of a planned task's steps, in the task's own order (a task may carry only some of the item's steps).
 * A date outside the task's timeframe counts as no date, so the step simply follows the task.
 */
export function taskStepDates(task: Task, node: GoalNode | null | undefined): (string | null)[] {
  if (!node || task.goalNodeId !== node.id || task.steps.length === 0) return task.steps.map(() => null);
  const range = task.targetDate ? dayRange(task.targetDate, task.endDate) : null;
  const all = nodeStepDates(node);
  return task.steps.map((_, position) => {
    const masterIndex = task.stepSlice ? task.stepSlice[position] : position;
    const date = all[masterIndex] ?? null;
    return range && inDayRange(date, range) ? date : null;
  });
}

/**
 * Which of a task's steps belong on `date`: the ones dated that day plus the ones with no day of their own.
 * A step dated for another day is left out of this day. Returns every step index when nothing is dated.
 */
export function stepIndicesForDay(stepDates: (string | null)[], date: string): number[] {
  const indices: number[] = [];
  stepDates.forEach((stepDate, i) => {
    if (!stepDate || stepDate === date) indices.push(i);
  });
  return indices;
}

/** Indices of the steps dated exactly on `date`. */
export function datedStepIndicesOn(stepDates: (string | null)[], date: string): number[] {
  const indices: number[] = [];
  stepDates.forEach((stepDate, i) => {
    if (stepDate === date) indices.push(i);
  });
  return indices;
}

/** Moves every step date by the same number of days (used when a task is moved to another day). */
export function shiftStepDates(dates: (string | null)[] | undefined, days: number): (string | null)[] | undefined {
  if (!dates) return undefined;
  const shifted = dates.map((date) => (isIsoDay(date) ? shiftLocalISO(date, days) : null));
  return shifted.some(Boolean) ? shifted : undefined;
}

/** Keeps the list parallel to the steps after the steps were edited by position (same rule the done flags follow). */
export function alignStepDates(dates: (string | null)[] | undefined, stepCount: number): (string | null)[] | undefined {
  if (!dates) return undefined;
  return normalizeStepDates(dates, stepCount);
}
