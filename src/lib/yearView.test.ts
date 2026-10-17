import { describe, expect, it } from 'vitest';
import type { DeviceCalendarEvent } from './deviceCalendar';
import { dayColorsByLongestEvent, yearEndDay, yearMonths, yearStartDay } from './yearView';

const event = (key: string, startDay: string, endDay: string, color: string, extra: Partial<DeviceCalendarEvent> = {}): DeviceCalendarEvent => ({
  id: key,
  key,
  calendarId: 'c1',
  title: key,
  description: '',
  location: '',
  allDay: true,
  begin: Date.parse(`${startDay}T00:00:00Z`),
  end: Date.parse(`${endDay}T00:00:00Z`) + 86_400_000,
  color,
  writable: true,
  startDay,
  endDay,
  ...extra,
});

describe('year layout', () => {
  it('has twelve months, each in whole Sunday-first rows', () => {
    const months = yearMonths(2026);
    expect(months).toHaveLength(12);
    for (const month of months) expect(month.cells.length % 7).toBe(0);
  });

  it('puts the 1st under the right weekday and counts the real days', () => {
    const october = yearMonths(2026)[9]; // 1 Oct 2026 is a Thursday
    expect(october.key).toBe('2026-10');
    expect(october.cells.slice(0, 4).every((cell) => cell.date === null)).toBe(true);
    expect(october.cells[4]).toEqual({ date: '2026-10-01', day: 1 });
    expect(october.cells.filter((cell) => cell.date).length).toBe(31);
  });

  it('knows a leap February', () => {
    expect(yearMonths(2028)[1].cells.filter((cell) => cell.date).length).toBe(29);
    expect(yearMonths(2027)[1].cells.filter((cell) => cell.date).length).toBe(28);
  });

  it('names the first and last day of a year', () => {
    expect(yearStartDay(2026)).toBe('2026-01-01');
    expect(yearEndDay(2026)).toBe('2026-12-31');
  });
});

describe('day colors', () => {
  it('colors every day an event covers and leaves other days out', () => {
    const colors = dayColorsByLongestEvent([event('a', '2026-10-12', '2026-10-14', '#111111')], '2026-01-01', '2026-12-31');
    expect(colors).toEqual({ '2026-10-12': '#111111', '2026-10-13': '#111111', '2026-10-14': '#111111' });
  });

  it('uses the longest event where several overlap', () => {
    const colors = dayColorsByLongestEvent(
      [
        event('short', '2026-10-13', '2026-10-13', '#00ff00'),
        event('long', '2026-10-11', '2026-10-17', '#ff0000'),
        event('mid', '2026-10-12', '2026-10-14', '#0000ff'),
      ],
      '2026-01-01',
      '2026-12-31',
    );
    expect(colors['2026-10-13']).toBe('#ff0000');
    expect(colors['2026-10-16']).toBe('#ff0000');
  });

  it('prefers an event that is longer overall even when only its tail is in view', () => {
    const colors = dayColorsByLongestEvent(
      [event('into-year', '2026-12-20', '2027-01-10', '#ff0000'), event('new-year', '2027-01-02', '2027-01-03', '#00ff00')],
      '2027-01-01',
      '2027-12-31',
    );
    expect(colors['2027-01-02']).toBe('#ff0000');
    expect(colors['2027-01-01']).toBe('#ff0000');
  });

  it('only fills days inside the range asked for', () => {
    const colors = dayColorsByLongestEvent([event('wrap', '2026-12-30', '2027-01-02', '#123456')], '2026-01-01', '2026-12-31');
    expect(Object.keys(colors).sort()).toEqual(['2026-12-30', '2026-12-31']);
  });

  it('does not change the winner when events come in a different order', () => {
    const a = event('a', '2026-10-12', '2026-10-12', '#aa0000');
    const b = event('b', '2026-10-12', '2026-10-12', '#00aa00');
    const one = dayColorsByLongestEvent([a, b], '2026-10-01', '2026-10-31');
    const two = dayColorsByLongestEvent([b, a], '2026-10-01', '2026-10-31');
    expect(one).toEqual(two);
  });
});
