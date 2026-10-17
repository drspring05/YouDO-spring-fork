import { describe, expect, it } from 'vitest';
import type { DeviceCalendarEvent } from './deviceCalendar';
import { eventSpanDays, innerEdges, isLongEvent, mergedBlocksForWeek, mergedTint } from './monthMerge';

const event = (key: string, startDay: string, endDay: string, extra: Partial<DeviceCalendarEvent> = {}): DeviceCalendarEvent => ({
  id: key,
  key,
  calendarId: 'c1',
  title: key,
  description: '',
  location: '',
  allDay: true,
  begin: Date.parse(`${startDay}T00:00:00Z`),
  end: Date.parse(`${endDay}T00:00:00Z`) + 86_400_000,
  color: '#3366cc',
  writable: true,
  startDay,
  endDay,
  ...extra,
});

// Sunday 11 Oct to Saturday 17 Oct 2026.
const WEEK = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];

describe('long events', () => {
  it('counts the days an event covers', () => {
    expect(eventSpanDays(event('a', '2026-10-12', '2026-10-12'))).toBe(1);
    expect(eventSpanDays(event('a', '2026-10-12', '2026-10-14'))).toBe(3);
  });

  it('only events of two or more days are long', () => {
    expect(isLongEvent(event('a', '2026-10-12', '2026-10-12'))).toBe(false);
    expect(isLongEvent(event('a', '2026-10-12', '2026-10-13'))).toBe(true);
  });
});

describe('merged blocks in a week row', () => {
  it('has no block when there are only one-day events', () => {
    expect(mergedBlocksForWeek(WEEK, [event('a', '2026-10-13', '2026-10-13')])).toEqual([]);
  });

  it('joins the days of one long event into one block', () => {
    const blocks = mergedBlocksForWeek(WEEK, [event('trip', '2026-10-13', '2026-10-15')]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ startCol: 2, endCol: 4, continuesBefore: false, continuesAfter: false });
  });

  it('cuts a block at the week row edges and marks that it carries on', () => {
    const event1 = event('long', '2026-10-09', '2026-10-13');
    const blocks = mergedBlocksForWeek(WEEK, [event1]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ startCol: 0, endCol: 2, continuesBefore: true, continuesAfter: false });

    const next = mergedBlocksForWeek(WEEK, [event('long2', '2026-10-16', '2026-10-20')]);
    expect(next[0]).toMatchObject({ startCol: 5, endCol: 6, continuesBefore: false, continuesAfter: true });
  });

  it('lets the longest overlapping event set the tint, ignoring a shorter one inside it', () => {
    const long = event('long', '2026-10-11', '2026-10-17', { color: '#ff0000' });
    const inside = event('inside', '2026-10-13', '2026-10-14', { color: '#00ff00' });
    const blocks = mergedBlocksForWeek(WEEK, [inside, long]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].event.key).toBe('long');
    expect(blocks[0]).toMatchObject({ startCol: 0, endCol: 6 });
  });

  it('gives the part of a shorter event that sticks out of the longest its own block', () => {
    const long = event('long', '2026-10-11', '2026-10-13', { color: '#ff0000' });
    const sticks = event('sticks', '2026-10-13', '2026-10-15', { color: '#00ff00' });
    const blocks = mergedBlocksForWeek(WEEK, [sticks, long]);
    expect(blocks.map((b) => [b.event.key, b.startCol, b.endCol])).toEqual([
      ['long', 0, 2],
      ['sticks', 3, 4],
    ]);
    expect(blocks[1].continuesBefore).toBe(true);
  });

  it('gives the same answer whatever order the events arrive in', () => {
    const a = event('a', '2026-10-12', '2026-10-14');
    const b = event('b', '2026-10-12', '2026-10-14');
    expect(mergedBlocksForWeek(WEEK, [a, b])[0].event.key).toBe(mergedBlocksForWeek(WEEK, [b, a])[0].event.key);
  });

  it('keeps separate blocks for events with a gap between them', () => {
    const blocks = mergedBlocksForWeek(WEEK, [
      event('one', '2026-10-11', '2026-10-12'),
      event('two', '2026-10-14', '2026-10-15'),
    ]);
    expect(blocks.map((b) => [b.startCol, b.endCol])).toEqual([[0, 1], [3, 4]]);
  });

  it('drops the line only between cells that share a block', () => {
    const blocks = mergedBlocksForWeek(WEEK, [event('trip', '2026-10-13', '2026-10-15')]);
    expect(innerEdges(blocks)).toEqual([false, false, true, true, false, false, false]);
  });
});

describe('merged tint', () => {
  it('is a darker, see-through version of the event color', () => {
    expect(mergedTint('#ff8000', 0.5, 0.5)).toBe('rgba(128, 64, 0, 0.5)');
  });

  it('falls back to grey for a color it cannot read', () => {
    expect(mergedTint('red')).toBe('rgba(139, 139, 139, 0.34)');
  });
});
