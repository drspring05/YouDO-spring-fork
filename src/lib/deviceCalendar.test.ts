import { describe, expect, it } from 'vitest';
import type { RawDeviceEvent } from './nativeCalendar';
import {
  eventTimeLabel,
  groupDeviceEventsByDay,
  queryWindow,
  toDeviceEvent,
  toDeviceEvents,
  type DeviceCalendarEvent,
} from './deviceCalendar';

const hour = 3_600_000;
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

describe('phone calendar events', () => {
  it('puts an all-day event on its own date regardless of the device time zone', () => {
    const e = event({ allDay: true, begin: Date.UTC(2026, 9, 14), end: Date.UTC(2026, 9, 15) });
    expect([e.startDay, e.endDay]).toEqual(['2026-10-14', '2026-10-14']);
  });

  it('treats the all-day end as exclusive so a 4-day event ends on its fourth day', () => {
    const e = event({ allDay: true, begin: Date.UTC(2026, 9, 4), end: Date.UTC(2026, 9, 8) });
    expect([e.startDay, e.endDay]).toEqual(['2026-10-04', '2026-10-07']);
  });

  it('keeps a timed event that ends exactly at midnight on its start day', () => {
    const e = event({ begin: new Date(2026, 9, 14, 22, 0).getTime(), end: new Date(2026, 9, 15, 0, 0).getTime() });
    expect([e.startDay, e.endDay]).toEqual(['2026-10-14', '2026-10-14']);
  });

  it('spans an overnight event across both local days', () => {
    const e = event({ begin: new Date(2026, 9, 14, 23, 0).getTime(), end: new Date(2026, 9, 15, 1, 0).getTime() });
    expect([e.startDay, e.endDay]).toEqual(['2026-10-14', '2026-10-15']);
  });

  it('handles a zero-length event', () => {
    const at = new Date(2026, 9, 14, 9, 0).getTime();
    const e = event({ begin: at, end: at });
    expect([e.startDay, e.endDay]).toEqual(['2026-10-14', '2026-10-14']);
  });

  it('falls back to a neutral color and drops unusable rows instead of throwing', () => {
    expect(event({ color: 'red' }).color).toBe('#8B8B8B');
    const rows = toDeviceEvents([raw({ begin: Number.NaN }), raw({ id: '2' })]);
    expect(rows.map((r) => r.id)).toEqual(['2']);
  });

  it('gives repeating occurrences distinct keys', () => {
    const a = event({ id: '7', begin: new Date(2026, 9, 14, 9, 0).getTime() });
    const b = event({ id: '7', begin: new Date(2026, 9, 21, 9, 0).getTime() });
    expect(a.key).not.toBe(b.key);
  });

  it('lists a multi-day event on every day it covers, all-day events first', () => {
    const trip = event({ id: 'trip', title: 'Trip', allDay: true, begin: Date.UTC(2026, 9, 4), end: Date.UTC(2026, 9, 7) });
    const early = event({ id: 'a', title: 'Early', begin: new Date(2026, 9, 5, 8, 0).getTime(), end: new Date(2026, 9, 5, 9, 0).getTime() });
    const byDay = groupDeviceEventsByDay([early, trip]);
    expect(Object.keys(byDay).sort()).toEqual(['2026-10-04', '2026-10-05', '2026-10-06']);
    expect(byDay['2026-10-05'].map((e) => e.title)).toEqual(['Trip', 'Early']);
  });

  it('caps the days a single event is spread over', () => {
    const forever = event({ allDay: true, begin: Date.UTC(2026, 0, 1), end: Date.UTC(2036, 0, 1) });
    expect(Object.keys(groupDeviceEventsByDay([forever])).length).toBeLessThanOrEqual(62);
  });

  it('labels all-day, timed and continuing events', () => {
    const allDay = event({ allDay: true, begin: Date.UTC(2026, 9, 14), end: Date.UTC(2026, 9, 15) });
    expect(eventTimeLabel(allDay, '2026-10-14')).toBe('All day');
    const timed = event({});
    expect(eventTimeLabel(timed, '2026-10-14')).toContain('–');
    const overnight = event({ begin: new Date(2026, 9, 14, 23, 0).getTime(), end: new Date(2026, 9, 15, 1, 0).getTime() });
    expect(eventTimeLabel(overnight, '2026-10-14')).toMatch(/^From /);
    expect(eventTimeLabel(overnight, '2026-10-15')).toMatch(/^Until /);
  });

  it('pads the query window by a day on each side', () => {
    const { start, end } = queryWindow('2026-10-01', '2026-10-31');
    expect(start).toBe(new Date(2026, 8, 30).getTime());
    expect(end).toBe(new Date(2026, 10, 2).getTime());
    expect(end - start).toBeGreaterThan(31 * 24 * hour);
  });
});
