import { describe, expect, it } from 'vitest';
import { eventWhen, hasChanges, isLinkedHere, reconcile, taskWhen, whenToTaskFields } from './taskCalendarSync';
import type { RawDeviceEvent } from './nativeCalendar';
import type { Task } from '../types';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Write report',
  description: 'Draft',
  priority: 'medium',
  targetDate: '2026-10-20',
  deadline: null,
  steps: [],
  progress: 0,
  createdAt: 0,
  order: 0,
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  calendarEventId: '5',
  calendarId: '1',
  ...over,
});

const eventFor = (t: Task, over: Partial<RawDeviceEvent> = {}): RawDeviceEvent => {
  const w = taskWhen(t)!;
  return {
    id: '5', calendarId: '1', title: t.title, description: t.description, location: '',
    allDay: w.allDay, begin: w.begin, end: w.end, color: '#112233', writable: true, ...over,
  };
};

const agreed = (t: Task) => reconcile(t, eventFor(t), null).snapshot;

describe('taskCalendarSync', () => {
  it('does nothing when task and event match', () => {
    const t = task();
    const r = reconcile(t, eventFor(t), agreed(t));
    expect(hasChanges(r.taskPatch)).toBe(false);
    expect(hasChanges(r.eventChanges)).toBe(false);
  });

  it('copies a calendar title edit into the task', () => {
    const t = task();
    const snap = agreed(t);
    const r = reconcile(t, eventFor(t, { title: 'Write the report' }), snap);
    expect(r.taskPatch.title).toBe('Write the report');
    expect(hasChanges(r.eventChanges)).toBe(false);
    expect(r.snapshot.content.title).toBe('Write the report');
  });

  it('copies a task title edit to the calendar', () => {
    const t = task();
    const snap = agreed(t);
    const r = reconcile({ ...t, title: 'Report v2' }, eventFor(t), snap);
    expect(r.eventChanges.title).toBe('Report v2');
    expect(hasChanges(r.taskPatch)).toBe(false);
  });

  it('keeps both edits when the title changes on one side and the time on the other', () => {
    const t = task();
    const snap = agreed(t);
    const moved = eventFor({ ...t, startTime: '14:00', endTime: '15:00' });
    const r = reconcile({ ...t, title: 'Report v2' }, moved, snap);
    expect(r.eventChanges.title).toBe('Report v2');
    expect(r.taskPatch.startTime).toBe('14:00');
    expect(r.taskPatch.endTime).toBe('15:00');
  });

  it('lets the calendar win when both sides changed the same thing', () => {
    const t = task();
    const snap = agreed(t);
    const r = reconcile({ ...t, title: 'From app' }, eventFor(t, { title: 'From phone' }), snap);
    expect(r.taskPatch.title).toBe('From phone');
    expect(hasChanges(r.eventChanges)).toBe(false);
  });

  it('moves the task to a new day when the event is moved', () => {
    const t = task();
    const snap = agreed(t);
    const r = reconcile(t, eventFor({ ...t, targetDate: '2026-10-22' }), snap);
    expect(r.taskPatch.targetDate).toBe('2026-10-22');
  });

  it('turns an all-day task into a timed one when the event gets times', () => {
    const t = task({ allDay: true, startTime: undefined, endTime: undefined });
    const snap = agreed(t);
    const timed = eventFor(task({ targetDate: t.targetDate, startTime: '08:30', endTime: '09:45' }));
    const r = reconcile(t, timed, snap);
    expect(r.taskPatch).toMatchObject({ allDay: false, startTime: '08:30', endTime: '09:45' });
  });

  it('pushes a task reschedule to the event, all-day included', () => {
    const t = task();
    const snap = agreed(t);
    const r = reconcile({ ...t, allDay: true, startTime: undefined, endTime: undefined }, eventFor(t), snap);
    expect(r.eventChanges.allDay).toBe(true);
    expect(r.eventChanges.end! - r.eventChanges.begin!).toBe(86_400_000);
  });

  it('takes the calendar as truth the first time a link is seen', () => {
    const t = task();
    const r = reconcile(t, eventFor(t, { title: 'Renamed in Calendar' }), null);
    expect(r.taskPatch.title).toBe('Renamed in Calendar');
  });

  it('leaves the schedule alone for repeating events', () => {
    const t = task();
    const snap = agreed(t);
    const recurring = eventFor(t, { recurring: true, begin: 0, end: 1 });
    expect(eventWhen(recurring)).toBeNull();
    const r = reconcile(t, recurring, snap);
    expect(hasChanges(r.taskPatch)).toBe(false);
    expect(hasChanges(r.eventChanges)).toBe(false);
  });

  it('reads multi-day events as a timeframe', () => {
    const allDay = task({ allDay: true, startTime: undefined, endTime: undefined });
    const begin = Date.UTC(2026, 9, 20);
    expect(eventWhen(eventFor(allDay, { begin, end: begin + 3 * 86_400_000 }))).toMatchObject({
      date: '2026-10-20',
      endDate: '2026-10-22',
    });
    const overnight = eventFor(task(), { end: eventFor(task()).begin + 20 * 3_600_000 });
    expect(eventWhen(overnight)).toMatchObject({ date: '2026-10-20', endDate: '2026-10-21' });
    // An all-day event that is not a whole number of days is not something a task can hold.
    expect(eventWhen(eventFor(allDay, { begin, end: begin + 86_400_000 + 3_600_000 }))).toBeNull();
  });

  it('never pushes into a read-only calendar and reverts the task edit', () => {
    const t = task();
    const snap = agreed(t);
    const r = reconcile({ ...t, title: 'Edited' }, eventFor(t), snap, false);
    expect(hasChanges(r.eventChanges)).toBe(false);
    expect(r.taskPatch.title).toBe('Write report');
  });

  it('keeps the task title, and gives the event that title, when the event has none', () => {
    const t = task();
    const r = reconcile(t, eventFor(t, { title: '' }), agreed(t));
    expect(hasChanges(r.taskPatch)).toBe(false);
    expect(r.eventChanges.title).toBe('Write report');
  });

  it('clips long calendar titles to the task limit without echoing them back', () => {
    const t = task();
    const snap = agreed(t);
    const long = 'x'.repeat(90);
    const r = reconcile(t, eventFor(t, { title: long }), snap);
    expect(r.taskPatch.title).toHaveLength(60);
    const next = { ...t, ...r.taskPatch };
    const again = reconcile(next, eventFor(t, { title: long }), r.snapshot);
    expect(hasChanges(again.taskPatch)).toBe(false);
    expect(hasChanges(again.eventChanges)).toBe(false);
  });

  it('round-trips schedule fields', () => {
    expect(whenToTaskFields({ date: '2026-10-20', endDate: '2026-10-20', allDay: true, begin: 0, end: 86_400_000 })).toMatchObject({
      allDay: true,
      startTime: undefined,
      endDate: undefined,
    });
    expect(whenToTaskFields({ date: '2026-10-20', endDate: '2026-10-22', allDay: true, begin: 0, end: 3 * 86_400_000 })).toMatchObject({
      targetDate: '2026-10-20',
      endDate: '2026-10-22',
    });
  });

  it('only syncs links made on this phone', () => {
    expect(isLinkedHere(task({ calendarDeviceId: 'a' }), 'a')).toBe(true);
    expect(isLinkedHere(task({ calendarDeviceId: 'b' }), 'a')).toBe(false);
    expect(isLinkedHere(task({ calendarDeviceId: undefined }), 'a')).toBe(true);
    expect(isLinkedHere(task({ calendarEventId: undefined }), 'a')).toBe(false);
  });
});

describe('task timeframes', () => {
  const allDayTask = (over: Partial<Task> = {}) => task({ allDay: true, startTime: undefined, endTime: undefined, ...over });

  it('turns a task timeframe into a multi-day window', () => {
    const when = taskWhen(allDayTask({ endDate: '2026-10-22' }))!;
    expect(when.endDate).toBe('2026-10-22');
    expect(when.end - when.begin).toBe(3 * 86_400_000);
  });

  it('treats an end date that is not after the first day as one day', () => {
    expect(taskWhen(allDayTask({ endDate: '2026-10-20' }))!.endDate).toBe('2026-10-20');
    expect(taskWhen(allDayTask({ endDate: '2026-10-18' }))!.endDate).toBe('2026-10-20');
  });

  it('puts the end time of a timed timeframe on the last day', () => {
    const when = taskWhen(task({ endDate: '2026-10-21', startTime: '22:00', endTime: '06:00' }))!;
    expect(when.begin).toBe(new Date(2026, 9, 20, 22, 0).getTime());
    expect(when.end).toBe(new Date(2026, 9, 21, 6, 0).getTime());
  });

  it('pushes a task timeframe to the event', () => {
    const t = allDayTask();
    const snap = agreed(t);
    const r = reconcile({ ...t, endDate: '2026-10-23' }, eventFor(t), snap);
    expect(r.eventChanges.allDay).toBe(true);
    expect(r.eventChanges.end! - r.eventChanges.begin!).toBe(4 * 86_400_000);
    expect(hasChanges(r.taskPatch)).toBe(false);
  });

  it('copies a calendar timeframe back onto the task', () => {
    const t = allDayTask();
    const snap = agreed(t);
    const r = reconcile(t, eventFor(allDayTask({ endDate: '2026-10-22' })), snap);
    expect(r.taskPatch.endDate).toBe('2026-10-22');
    expect(hasChanges(r.eventChanges)).toBe(false);
  });
});

describe('task color', () => {
  it('pushes the task color to an event that shows another one', () => {
    const t = task({ color: '#FF0000' });
    const r = reconcile(t, eventFor(t), agreed(t));
    expect(r.eventChanges.color).toBe('#FF0000');
  });

  it('does nothing when the event already has that color, in any letter case', () => {
    const t = task({ color: '#aabbcc' });
    const r = reconcile(t, eventFor(t, { color: '#AABBCC' }), agreed(t));
    expect(hasChanges(r.eventChanges)).toBe(false);
  });

  it('leaves the event color alone for a task without one, and for a read-only calendar', () => {
    const t = task();
    expect(hasChanges(reconcile(t, eventFor(t), agreed(t)).eventChanges)).toBe(false);
    const colored = task({ color: '#FF0000' });
    expect(reconcile(colored, eventFor(colored), agreed(colored), false).eventChanges.color).toBeUndefined();
  });
});
