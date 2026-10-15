import { describe, expect, it } from 'vitest';
import type { RawDeviceEvent } from './nativeCalendar';
import { toDeviceEvent, type DeviceCalendarEvent } from './deviceCalendar';
import { chunkWeeks, layoutWeek, monthGridDays, readableTextColor } from './monthLayout';

const raw = (patch: Partial<RawDeviceEvent>): RawDeviceEvent => ({
  id: '1',
  calendarId: '1',
  title: 'Event',
  description: '',
  location: '',
  allDay: false,
  begin: new Date(2026, 9, 14, 15, 0).getTime(),
  end: new Date(2026, 9, 14, 16, 0).getTime(),
  color: '#336699',
  writable: true,
  ...patch,
});
const event = (patch: Partial<RawDeviceEvent>): DeviceCalendarEvent => {
  const parsed = toDeviceEvent(raw(patch));
  if (!parsed) throw new Error('fixture rejected');
  return parsed;
};
const timed = (id: string, startDay: number, endDay: number, title = id) =>
  event({
    id,
    title,
    begin: new Date(2026, 9, startDay, 9, 0).getTime(),
    end: new Date(2026, 9, endDay, 10, 0).getTime(),
  });

describe('monthGridDays', () => {
  it('returns whole Sunday-first weeks that contain the month', () => {
    const days = monthGridDays(2026, 9); // October 2026 starts on a Thursday
    expect(days).toHaveLength(35);
    expect(days[0]).toBe('2026-09-27');
    expect(days[4]).toBe('2026-10-01');
    expect(days[34]).toBe('2026-10-31');
  });

  it('adds a sixth week only when the month needs it', () => {
    expect(monthGridDays(2026, 1)).toHaveLength(28); // February 2026 fits exactly in four weeks
    expect(monthGridDays(2026, 7)).toHaveLength(42); // August 2026 starts on a Saturday
  });

  it('chunks into rows of seven', () => {
    const weeks = chunkWeeks(monthGridDays(2026, 9));
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe('layoutWeek', () => {
  // Week of Sunday 11 Oct 2026 to Saturday 17 Oct 2026
  const week = chunkWeeks(monthGridDays(2026, 9))[2];

  it('places a one-day event in its column', () => {
    const { bars } = layoutWeek(week, [timed('a', 14, 14)]);
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ startCol: 3, endCol: 3, lane: 0, continuesBefore: false, continuesAfter: false });
  });

  it('stretches a multi-day event across its days', () => {
    const { bars } = layoutWeek(week, [timed('trip', 13, 15)]);
    expect(bars[0]).toMatchObject({ startCol: 2, endCol: 4 });
  });

  it('clips an event that runs past the edges and marks that it continues', () => {
    const { bars } = layoutWeek(week, [timed('long', 8, 20)]);
    expect(bars[0]).toMatchObject({ startCol: 0, endCol: 6, continuesBefore: true, continuesAfter: true });
  });

  it('ignores events outside the week', () => {
    expect(layoutWeek(week, [timed('later', 20, 21)]).bars).toHaveLength(0);
  });

  it('stacks overlapping events and reuses a lane once it is free', () => {
    const { bars } = layoutWeek(week, [timed('a', 12, 13), timed('b', 13, 14), timed('c', 15, 15)]);
    const lane = (id: string) => bars.find((bar) => bar.event.id === id)?.lane;
    expect(lane('a')).toBe(0);
    expect(lane('b')).toBe(1);
    expect(lane('c')).toBe(0);
  });

  it('counts events that do not fit instead of drawing them', () => {
    const events = ['a', 'b', 'c', 'd', 'e'].map((id) => timed(id, 14, 14));
    const { bars, hidden } = layoutWeek(week, events, 3);
    expect(bars).toHaveLength(3);
    expect(hidden[3]).toBe(2);
    expect(hidden[2]).toBe(0);
  });

  it('gives longer and all-day events the first lanes', () => {
    const allDay = event({
      id: 'holiday',
      title: 'Holiday',
      allDay: true,
      begin: Date.UTC(2026, 9, 14),
      end: Date.UTC(2026, 9, 15),
    });
    const { bars } = layoutWeek(week, [timed('meeting', 14, 14), allDay]);
    expect(bars.find((bar) => bar.event.id === 'holiday')?.lane).toBe(0);
  });
});

describe('readableTextColor', () => {
  it('uses dark text on light colors and white text on dark ones', () => {
    expect(readableTextColor('#FFEB3B')).toBe('#111111');
    expect(readableTextColor('#1A237E')).toBe('#ffffff');
  });

  it('falls back to white for anything that is not a hex color', () => {
    expect(readableTextColor('red')).toBe('#ffffff');
  });
});
