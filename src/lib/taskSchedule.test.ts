import { describe, expect, it } from 'vitest';
import type { DeviceCalendar } from './nativeCalendar';
import { chooseTaskCalendar, defaultTimes, eventWindow, isClockTime, scheduleError, scheduleFields } from './taskSchedule';

const timed = (startTime: string, endTime: string) => ({ allDay: false, startTime, endTime });
const calendar = (patch: Partial<DeviceCalendar>): DeviceCalendar => ({
  id: '1',
  name: 'Personal',
  accountName: 'me@example.com',
  color: '#336699',
  writable: true,
  visible: true,
  ...patch,
});

describe('clock times', () => {
  it('accepts HH:mm only', () => {
    expect(isClockTime('09:30')).toBe(true);
    expect(isClockTime('23:59')).toBe(true);
    expect(isClockTime('24:00')).toBe(false);
    expect(isClockTime('9:30')).toBe(false);
    expect(isClockTime(null)).toBe(false);
  });

  it('starts at the next full hour and stays on the same day', () => {
    expect(defaultTimes(new Date(2026, 9, 15, 13, 51))).toEqual({ startTime: '14:00', endTime: '15:00' });
    expect(defaultTimes(new Date(2026, 9, 15, 23, 40))).toEqual({ startTime: '22:00', endTime: '23:00' });
  });
});

describe('scheduleError', () => {
  it('lets all-day through without looking at times', () => {
    expect(scheduleError({ allDay: true, startTime: '', endTime: '' })).toBeNull();
  });

  it('needs an end after the start', () => {
    expect(scheduleError(timed('15:00', '16:00'))).toBeNull();
    expect(scheduleError(timed('15:00', '15:00'))).not.toBeNull();
    expect(scheduleError(timed('16:00', '15:00'))).not.toBeNull();
    expect(scheduleError(timed('', '15:00'))).not.toBeNull();
  });
});

describe('scheduleFields', () => {
  it('stores nothing for a task with no date', () => {
    expect(scheduleFields(null, timed('15:00', '16:00'))).toEqual({});
  });

  it('stores only the all-day flag for an all-day task', () => {
    expect(scheduleFields('2026-10-15', { allDay: true, startTime: '15:00', endTime: '16:00' })).toEqual({ allDay: true });
  });

  it('stores the times for a timed task', () => {
    expect(scheduleFields('2026-10-15', timed('15:00', '16:00'))).toEqual({ allDay: false, startTime: '15:00', endTime: '16:00' });
  });
});

describe('eventWindow', () => {
  it('uses UTC midnights with an exclusive end for all-day', () => {
    const window = eventWindow('2026-10-15', { allDay: true, startTime: '', endTime: '' });
    expect(window).toEqual({ allDay: true, begin: Date.UTC(2026, 9, 15), end: Date.UTC(2026, 9, 16) });
  });

  it('uses local instants for a timed task', () => {
    const window = eventWindow('2026-10-15', timed('15:00', '16:30'));
    expect(window).toEqual({
      allDay: false,
      begin: new Date(2026, 9, 15, 15, 0).getTime(),
      end: new Date(2026, 9, 15, 16, 30).getTime(),
    });
  });

  it('refuses a bad date or bad times', () => {
    expect(eventWindow('15/10/2026', timed('15:00', '16:00'))).toBeNull();
    expect(eventWindow('2026-10-15', timed('16:00', '15:00'))).toBeNull();
  });
});

describe('chooseTaskCalendar', () => {
  const personal = calendar({ id: '1', name: 'me@example.com', accountName: 'me@example.com' });
  const college = calendar({ id: '2', name: 'College', accountName: 'me@example.com' });
  const holidays = calendar({ id: '3', name: 'Holidays', accountName: 'me@example.com', writable: false });

  it('prefers the remembered writable calendar', () => {
    expect(chooseTaskCalendar([personal, college, holidays], '2')?.id).toBe('2');
  });

  it('falls back to the account main calendar when the saved one is gone or read-only', () => {
    expect(chooseTaskCalendar([college, personal, holidays], '3')?.id).toBe('1');
    expect(chooseTaskCalendar([college, personal], '99')?.id).toBe('1');
  });

  it('takes the first writable calendar when none is the main one, and null when none can be written', () => {
    expect(chooseTaskCalendar([holidays, college], null)?.id).toBe('2');
    expect(chooseTaskCalendar([holidays], null)).toBeNull();
    expect(chooseTaskCalendar([], null)).toBeNull();
  });
});

describe('timeframes over several days', () => {
  it('lets the end time be earlier than the start time when the end is on a later day', () => {
    expect(scheduleError(timed('22:00', '06:00'), false)).toBeNull();
    expect(scheduleError(timed('22:00', '06:00'))).not.toBeNull();
    expect(scheduleError(timed('', '06:00'), false)).not.toBeNull();
  });

  it('makes an all-day window from the first day to the end of the last day', () => {
    expect(eventWindow('2026-10-20', { allDay: true, startTime: '', endTime: '' }, '2026-10-22')).toEqual({
      allDay: true,
      begin: Date.UTC(2026, 9, 20),
      end: Date.UTC(2026, 9, 23),
    });
  });

  it('starts a timed window on the first day and ends it on the last', () => {
    expect(eventWindow('2026-10-20', timed('22:00', '06:00'), '2026-10-21')).toEqual({
      allDay: false,
      begin: new Date(2026, 9, 20, 22, 0).getTime(),
      end: new Date(2026, 9, 21, 6, 0).getTime(),
    });
  });

  it('treats an end that is not after the first day as one day', () => {
    const allDay = { allDay: true, startTime: '', endTime: '' };
    expect(eventWindow('2026-10-20', allDay, '2026-10-20')).toEqual(eventWindow('2026-10-20', allDay));
    expect(eventWindow('2026-10-20', allDay, '2026-10-19')).toEqual(eventWindow('2026-10-20', allDay));
    expect(eventWindow('2026-10-20', timed('10:00', '09:00'), '2026-10-19')).toBeNull();
  });
});
