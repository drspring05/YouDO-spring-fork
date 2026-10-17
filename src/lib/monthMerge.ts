import { daysBetweenLocalISO } from './dates';
import type { DeviceCalendarEvent } from './deviceCalendar';

/**
 * Month view, Samsung Calendar style: an event that lasts two or more days joins its day cells into one
 * tinted block. Where long events overlap, the longest one sets the merge and the tint; a shorter event inside
 * it changes nothing (it keeps its own colored bar on top). A block never crosses a week row.
 */

/** One merged block inside a single week row (columns 0–6, Sunday first). */
export interface MergedBlock {
  startCol: number;
  endCol: number;
  /** the event whose color tints the block */
  event: DeviceCalendarEvent;
  /** the event started before this block's first column */
  continuesBefore: boolean;
  /** the event carries on after this block's last column */
  continuesAfter: boolean;
}

/** How many calendar days the whole event covers. */
export const eventSpanDays = (event: Pick<DeviceCalendarEvent, 'startDay' | 'endDay'>): number =>
  daysBetweenLocalISO(event.startDay, event.endDay) + 1;

/** Events that cover two or more days are the ones that merge cells. */
export const isLongEvent = (event: Pick<DeviceCalendarEvent, 'startDay' | 'endDay'>): boolean =>
  event.endDay > event.startDay;

/** Longest first; ties go to all-day events, then the earlier start, then the key, so the result never flips. */
export function compareLongestFirst(a: DeviceCalendarEvent, b: DeviceCalendarEvent): number {
  return (
    eventSpanDays(b) - eventSpanDays(a) ||
    Number(b.allDay) - Number(a.allDay) ||
    a.begin - b.begin ||
    a.key.localeCompare(b.key)
  );
}

/**
 * The merged blocks of one week row. Each column belongs to the longest long event covering it (or to none);
 * neighbouring columns with the same winner form one block.
 */
export function mergedBlocksForWeek(days: string[], events: DeviceCalendarEvent[]): MergedBlock[] {
  if (days.length === 0) return [];
  const first = days[0];
  const last = days[days.length - 1];
  const long = events
    .filter((event) => isLongEvent(event) && event.startDay <= last && event.endDay >= first)
    .sort(compareLongestFirst);
  if (long.length === 0) return [];

  const winners = days.map((day) => long.find((event) => event.startDay <= day && event.endDay >= day) ?? null);
  const blocks: MergedBlock[] = [];
  let col = 0;
  while (col < winners.length) {
    const event = winners[col];
    if (!event) {
      col += 1;
      continue;
    }
    let end = col;
    while (end + 1 < winners.length && winners[end + 1]?.key === event.key) end += 1;
    blocks.push({
      startCol: col,
      endCol: end,
      event,
      continuesBefore: event.startDay < days[col],
      continuesAfter: event.endDay > days[end],
    });
    col = end + 1;
  }
  return blocks;
}

/**
 * The block background: the event color made darker and dimmer (as a see-through darker shade), so the date
 * numbers stay readable on top and the event's own bar still stands out against it.
 */
export function mergedTint(hex: string, alpha = 0.34, darken = 0.6): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return `rgba(139, 139, 139, ${alpha})`;
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * darken);
  return `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${alpha})`;
}

/**
 * Per column, whether the cell shares a block with the cell on its right (so the line between them is dropped).
 */
export function innerEdges(blocks: MergedBlock[], columns = 7): boolean[] {
  const edges = Array.from({ length: columns }, () => false);
  for (const block of blocks) {
    for (let col = block.startCol; col < block.endCol; col++) edges[col] = true;
  }
  return edges;
}
