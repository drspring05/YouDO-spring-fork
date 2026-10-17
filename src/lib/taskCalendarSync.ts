import { localISODate } from './dates';
import { readStorageRaw } from './storageKeys';
import { sameColor } from './eventColors';
import { eventWindow, type ScheduleDraft } from './taskSchedule';
import { TITLE_MAX } from './titleLimit';
import type { DeviceEventChanges, RawDeviceEvent } from './nativeCalendar';
import type { Task } from '../types';

/**
 * Two-way sync between a task and the phone-calendar event made for it.
 *
 * Each sync compares three things: the task, the event, and a "snapshot" of what both looked like the last
 * time they agreed. A side that differs from the snapshot has been edited. If only one side was edited the
 * other copies it. If both were edited the phone calendar wins, since that is the shared copy.
 * The title/details and the date/time are compared separately, so editing one on each side keeps both edits.
 */

const DAY_MS = 86_400_000;

export interface Content {
  title: string;
  description: string;
}

export interface When {
  /** first local day, YYYY-MM-DD */
  date: string;
  /** last local day, YYYY-MM-DD, inclusive. Same as `date` for a one-day schedule. */
  endDate: string;
  allDay: boolean;
  /** epoch ms, same rules as a calendar event (all-day = UTC midnights, exclusive end) */
  begin: number;
  end: number;
}

/** What the task and event last agreed on. `when` is null while the event had no one-day schedule. */
export interface Snapshot {
  content: Content;
  when: When | null;
}

const clip = (title: string) => title.trim().slice(0, TITLE_MAX).trim();

const contentOf = (title: string, description: string): Content => ({
  title: clip(title),
  description: description.trim(),
});

const sameContent = (a: Content, b: Content) => a.title === b.title && a.description === b.description;
const sameWhen = (a: When, b: When) =>
  a.allDay === b.allDay && a.begin === b.begin && a.end === b.end && a.date === b.date && a.endDate === b.endDate;

/** The task's schedule as an event window, or null when it has no date. */
export function taskWhen(task: Task): When | null {
  if (!task.targetDate) return null;
  const timed = task.allDay === false && task.startTime && task.endTime;
  const draft: ScheduleDraft = timed
    ? { allDay: false, startTime: task.startTime as string, endTime: task.endTime as string }
    : { allDay: true, startTime: '', endTime: '' };
  const endDate = task.endDate && task.endDate > task.targetDate ? task.endDate : task.targetDate;
  const slot = eventWindow(task.targetDate, draft, endDate);
  return slot ? { date: task.targetDate, endDate, ...slot } : null;
}

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const clockOf = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * The event's schedule as a task timeframe (one day or several). Null when a task can't hold it: a
 * repeating event, or an all-day event whose length is not a whole number of days.
 */
export function eventWhen(event: RawDeviceEvent): When | null {
  if (event.recurring) return null;
  if (!Number.isFinite(event.begin) || !Number.isFinite(event.end) || event.end <= event.begin) return null;
  if (event.allDay) {
    const span = event.end - event.begin;
    if (span < DAY_MS || span % DAY_MS !== 0) return null;
    return { date: utcDay(event.begin), endDate: utcDay(event.end - DAY_MS), allDay: true, begin: event.begin, end: event.end };
  }
  const date = localISODate(new Date(event.begin));
  const endDate = localISODate(new Date(event.end - 1));
  return { date, endDate, allDay: false, begin: event.begin, end: event.end };
}

/** Task fields that describe a schedule taken from the calendar. */
export function whenToTaskFields(when: When): Pick<Task, 'targetDate' | 'endDate' | 'allDay' | 'startTime' | 'endTime'> {
  const endDate = when.endDate > when.date ? when.endDate : undefined;
  if (when.allDay) return { targetDate: when.date, endDate, allDay: true, startTime: undefined, endTime: undefined };
  return { targetDate: when.date, endDate, allDay: false, startTime: clockOf(when.begin), endTime: clockOf(when.end) };
}

export interface Reconciled {
  /** Changes to make to the task (calendar edits coming in). Empty when there are none. */
  taskPatch: Partial<Task>;
  /** Changes to make to the event (task edits going out). Empty when there are none. */
  eventChanges: DeviceEventChanges;
  /** Store this once the changes above have been made. */
  snapshot: Snapshot;
}

/**
 * Works out what to copy in each direction. `snapshot` is null the first time a link is seen; the event is
 * then taken as the truth, because the task and event were made together and any difference is a calendar edit.
 * `canWrite` is false for a calendar that has become read-only: nothing is pushed to it.
 */
export function reconcile(task: Task, event: RawDeviceEvent, snapshot: Snapshot | null, canWrite = true): Reconciled {
  const taskPatch: Partial<Task> = {};
  const eventChanges: DeviceEventChanges = {};

  const taskContent = contentOf(task.title, task.description);
  const eventContent = contentOf(event.title, event.description);
  const eventSchedule = eventWhen(event);
  const taskSchedule = taskWhen(task);

  // Title and details.
  let agreedContent = eventContent;
  if (snapshot) {
    const eventEdited = !sameContent(eventContent, snapshot.content);
    const taskEdited = !sameContent(taskContent, snapshot.content);
    if (!eventEdited && taskEdited && canWrite) agreedContent = taskContent;
    else if (!eventEdited && taskEdited) agreedContent = snapshot.content;
  }
  // A calendar event can have no title; the task keeps its own rather than ending up nameless.
  if (!agreedContent.title) agreedContent = { ...agreedContent, title: taskContent.title };
  if (!sameContent(agreedContent, taskContent)) {
    taskPatch.title = agreedContent.title;
    taskPatch.description = agreedContent.description;
  }
  if (canWrite && !sameContent(agreedContent, eventContent)) {
    eventChanges.title = agreedContent.title;
    eventChanges.description = agreedContent.description;
  }

  // Color: the task's own color is pushed to the event. A task without one leaves the event's color alone.
  if (canWrite && task.color && !sameColor(task.color, event.color)) eventChanges.color = task.color;

  // Date and time. Only when the event is not a repeating one and the task has a date.
  let agreedWhen: When | null = eventSchedule;
  if (eventSchedule && taskSchedule) {
    const base = snapshot?.when ?? null;
    const eventEdited = base ? !sameWhen(eventSchedule, base) : !sameWhen(eventSchedule, taskSchedule);
    const taskEdited = base ? !sameWhen(taskSchedule, base) : false;
    if (!eventEdited && taskEdited && canWrite) agreedWhen = taskSchedule;
    else if (!eventEdited && taskEdited) agreedWhen = base;
    if (agreedWhen && !sameWhen(agreedWhen, taskSchedule)) Object.assign(taskPatch, whenToTaskFields(agreedWhen));
    if (agreedWhen && canWrite && !sameWhen(agreedWhen, eventSchedule)) {
      eventChanges.allDay = agreedWhen.allDay;
      eventChanges.begin = agreedWhen.begin;
      eventChanges.end = agreedWhen.end;
    }
  } else if (eventSchedule && !taskSchedule) {
    agreedWhen = eventSchedule;
  }

  return { taskPatch, eventChanges, snapshot: { content: agreedContent, when: agreedWhen } };
}

export const hasChanges = (changes: object) => Object.keys(changes).length > 0;

/** True when the event no longer matches the calendar the task was linked to. */
export const isSameCalendar = (task: Task, event: RawDeviceEvent) => !task.calendarId || task.calendarId === event.calendarId;

/* ─── Per-phone storage ──────────────────────────────────────────────────── */

export const SNAPSHOTS_KEY = 'youdo-task-calendar-sync-v1';
export const DEVICE_ID_KEY = 'youdo-device-id-v1';
export const PENDING_DELETES_KEY = 'youdo-task-calendar-deletes-v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = readStorageRaw(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sync still works; it just treats the link as new next time */
  }
}

/** An id for this install of the app. Event ids only mean something on the phone that made them. */
export function getCalendarDeviceId(): string {
  const saved = readJson<unknown>(DEVICE_ID_KEY, null);
  if (typeof saved === 'string' && saved) return saved;
  const id = `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  writeJson(DEVICE_ID_KEY, id);
  return id;
}

export function readSnapshots(): Record<string, Snapshot> {
  const value = readJson<unknown>(SNAPSHOTS_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Snapshot>) : {};
}

export function writeSnapshots(snapshots: Record<string, Snapshot>) {
  writeJson(SNAPSHOTS_KEY, snapshots);
}

/** Events that should be deleted from the phone but could not be yet (for example, permission was off). */
export interface PendingDelete {
  eventId: string;
  calendarId: string;
}

export function readPendingDeletes(): PendingDelete[] {
  const value = readJson<unknown>(PENDING_DELETES_KEY, []);
  return Array.isArray(value)
    ? value.filter((item): item is PendingDelete => !!item && typeof item.eventId === 'string' && typeof item.calendarId === 'string')
    : [];
}

export function writePendingDeletes(list: PendingDelete[]) {
  writeJson(PENDING_DELETES_KEY, list.slice(-200));
}

/** A task whose event was made on this phone and can therefore be synced here. */
export function isLinkedHere(task: Task, deviceId: string): boolean {
  return Boolean(task.calendarEventId) && (!task.calendarDeviceId || task.calendarDeviceId === deviceId);
}
