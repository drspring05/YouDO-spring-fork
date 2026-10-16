import { describe, expect, it } from 'vitest';
import { canEditSchedule, draftError, draftFromEvent, draftSchedule, newDraft, toChanges, toNewEvent } from './eventEdit';
import { toDeviceEvent } from './deviceCalendar';
import type { RawDeviceEvent } from './nativeCalendar';

const DAY = 86_400_000;

const raw = (over: Partial<RawDeviceEvent> = {}): RawDeviceEvent => ({
  id: '5',
  calendarId: '1',
  title: 'Lecture',
  description: '',
  location: '',
  allDay: false,
  begin: new Date(2026, 9, 20, 10, 0).getTime(),
  end: new Date(2026, 9, 20, 11, 30).getTime(),
  color: '#336699',
  writable: true,
  ...over,
});

const event = (over: Partial<RawDeviceEvent> = {}) => toDeviceEvent(raw(over))!;

describe('newDraft', () => {
  it('starts all-day on the chosen date', () => {
    const draft = newDraft('2026-10-20', new Date(2026, 9, 20, 9, 15));
    expect(draft).toMatchObject({ title: '', allDay: true, startDate: '2026-10-20', endDate: '2026-10-20' });
    expect(draft.startTime).toBe('10:00');
    expect(draft.endTime).toBe('11:00');
  });
});

describe('draftFromEvent', () => {
  it('reads a timed event in local time', () => {
    const draft = draftFromEvent(event());
    expect(draft).toMatchObject({ allDay: false, startDate: '2026-10-20', endDate: '2026-10-20', startTime: '10:00', endTime: '11:30' });
  });

  it('reads an all-day range with an inclusive last day', () => {
    const begin = Date.UTC(2026, 9, 20);
    const draft = draftFromEvent(event({ allDay: true, begin, end: begin + 3 * DAY }));
    expect(draft).toMatchObject({ allDay: true, startDate: '2026-10-20', endDate: '2026-10-22' });
  });

  it('reads a one-day all-day event as a single day', () => {
    const begin = Date.UTC(2026, 9, 20);
    const draft = draftFromEvent(event({ allDay: true, begin, end: begin + DAY }));
    expect(draft).toMatchObject({ startDate: '2026-10-20', endDate: '2026-10-20' });
  });
});

describe('draftSchedule', () => {
  it('makes an all-day window on UTC midnights with an exclusive end', () => {
    const draft = { ...newDraft('2026-10-20'), startDate: '2026-10-20', endDate: '2026-10-21' };
    expect(draftSchedule(draft)).toEqual({ allDay: true, begin: Date.UTC(2026, 9, 20), end: Date.UTC(2026, 9, 22) });
  });

  it('makes a timed window in local time, including across midnight', () => {
    const draft = { ...newDraft('2026-10-20'), allDay: false, endDate: '2026-10-21', startTime: '22:00', endTime: '01:00' };
    expect(draftSchedule(draft)).toEqual({
      allDay: false,
      begin: new Date(2026, 9, 20, 22, 0).getTime(),
      end: new Date(2026, 9, 21, 1, 0).getTime(),
    });
  });

  it('rejects an end that is not after the start', () => {
    expect(draftSchedule({ ...newDraft('2026-10-20'), allDay: false, startTime: '10:00', endTime: '10:00' })).toBeNull();
    expect(draftSchedule({ ...newDraft('2026-10-20'), startDate: '2026-10-21', endDate: '2026-10-20' })).toBeNull();
    expect(draftSchedule({ ...newDraft('2026-10-20'), startDate: '' })).toBeNull();
  });
});

describe('draftError', () => {
  it('needs a title', () => {
    expect(draftError({ ...newDraft('2026-10-20'), title: '   ' })).toBe('Give the event a title.');
  });
  it('explains a bad schedule in plain words', () => {
    const base = { ...newDraft('2026-10-20'), title: 'x' };
    expect(draftError({ ...base, startDate: '' })).toBe('Pick a date.');
    expect(draftError({ ...base, startDate: '2026-10-21', endDate: '2026-10-20' })).toMatch(/end date/);
    expect(draftError({ ...base, allDay: false, startTime: '', endTime: '10:00' })).toBe('Pick a start and an end time.');
    expect(draftError({ ...base, allDay: false, startTime: '11:00', endTime: '10:00' })).toBe('The end must be after the start.');
  });
  it('can skip the schedule check', () => {
    expect(draftError({ ...newDraft('2026-10-20'), title: 'x', startDate: '' }, false)).toBeNull();
  });
  it('accepts a good form', () => {
    expect(draftError({ ...newDraft('2026-10-20'), title: 'x' })).toBeNull();
  });
});

describe('toNewEvent', () => {
  it('trims text and carries the schedule and calendar', () => {
    const made = toNewEvent({ ...newDraft('2026-10-20'), title: '  Dentist ', description: ' bring forms ' }, '7');
    expect(made).toEqual({
      calendarId: '7',
      title: 'Dentist',
      description: 'bring forms',
      allDay: true,
      begin: Date.UTC(2026, 9, 20),
      end: Date.UTC(2026, 9, 21),
    });
  });
  it('is null for an invalid form', () => {
    expect(toNewEvent(newDraft('2026-10-20'), '7')).toBeNull();
  });
});

describe('toChanges', () => {
  it('is empty when nothing changed', () => {
    const e = event();
    expect(toChanges(e, draftFromEvent(e), true)).toEqual({});
  });

  it('sends only the text that changed', () => {
    const e = event({ description: 'room 4' });
    expect(toChanges(e, { ...draftFromEvent(e), title: 'Physics lecture' }, true)).toEqual({ title: 'Physics lecture' });
    expect(toChanges(e, { ...draftFromEvent(e), description: '' }, true)).toEqual({ description: '' });
  });

  it('sends allDay, begin and end together when the schedule changed', () => {
    const e = event();
    const changes = toChanges(e, { ...draftFromEvent(e), endTime: '12:00' }, true);
    expect(changes).toEqual({ allDay: false, begin: e.begin, end: new Date(2026, 9, 20, 12, 0).getTime() });
  });

  it('ignores schedule edits when the schedule is locked', () => {
    const e = event({ recurring: true });
    expect(canEditSchedule(e)).toBe(false);
    expect(toChanges(e, { ...draftFromEvent(e), endTime: '12:00', title: 'Renamed' }, false)).toEqual({ title: 'Renamed' });
  });

  it('turning all-day on rewrites the schedule to whole days', () => {
    const e = event();
    const changes = toChanges(e, { ...draftFromEvent(e), allDay: true }, true);
    expect(changes).toEqual({ allDay: true, begin: Date.UTC(2026, 9, 20), end: Date.UTC(2026, 9, 21) });
  });
});

describe('canEditSchedule', () => {
  it('is false for repeating events and read-only calendars', () => {
    expect(canEditSchedule(event())).toBe(true);
    expect(canEditSchedule(event({ recurring: true }))).toBe(false);
    expect(canEditSchedule(event({ writable: false }))).toBe(false);
  });
});
