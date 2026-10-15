import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  deleteDeviceEvent,
  getDeviceCalendarPermission,
  getDeviceEvents,
  supportsDeviceCalendar,
  updateDeviceEvent,
  type RawDeviceEvent,
} from '../lib/nativeCalendar';
import {
  getCalendarDeviceId,
  hasChanges,
  isLinkedHere,
  isSameCalendar,
  readPendingDeletes,
  readSnapshots,
  reconcile,
  writePendingDeletes,
  writeSnapshots,
} from '../lib/taskCalendarSync';
import type { Task } from '../types';

/** Fired after YouDo changes the phone calendar, so open calendar views reload right away. */
export const CALENDAR_CHANGED_EVENT = 'youdo-calendar-changed';

const LOOKUP_CHUNK = 200;
const DEBOUNCE_MS = 700;

/** Removes the link fields from a task, leaving the task itself as it is. */
export const withoutCalendarLink = (task: Task): Task => {
  const { calendarEventId: _event, calendarId: _calendar, calendarDeviceId: _device, ...rest } = task;
  void _event;
  void _calendar;
  void _device;
  return rest;
};

/** Only the fields that sync cares about, so unrelated task changes (progress, order) don't trigger a pass. */
const syncSignature = (tasks: Task[]) =>
  tasks
    .filter((task) => task.calendarEventId)
    .map((task) =>
      [task.id, task.title, task.description, task.targetDate, task.allDay, task.startTime, task.endTime, task.calendarEventId, task.calendarId].join('\u0001'),
    )
    .join('\u0002');

/**
 * Keeps tasks and their phone-calendar events in step, both ways (Android only).
 * - Edits made in the Calendar app (title, details, day, time) are copied onto the task.
 * - Edits made to the task are copied onto the event.
 * - Deleting a task deletes its event. If the event is deleted on the phone, `gone` lists the task so the
 *   app can ask before deleting it (a task can hold progress that is worth keeping).
 * Runs when the app opens, when it comes back to the foreground, and shortly after a linked task changes.
 */
export function useTaskCalendarSync(
  tasks: Task[],
  tasksRef: MutableRefObject<Task[]>,
  setTasks: Dispatch<SetStateAction<Task[]>>,
) {
  const supported = supportsDeviceCalendar();
  const [gone, setGone] = useState<Task[]>([]);
  const running = useRef(false);
  const again = useRef(false);
  const deferred = useRef(new Set<string>());

  const runSync = useCallback(async () => {
    if (!supported) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        await syncPass();
      } while (again.current);
    } finally {
      running.current = false;
    }

    async function syncPass() {
      try {
        if ((await getDeviceCalendarPermission()) !== 'granted') return;
      } catch {
        return;
      }

      let changedPhone = await retryPendingDeletes();

      const deviceId = getCalendarDeviceId();
      const linked = tasksRef.current.filter((task) => isLinkedHere(task, deviceId));
      const snapshots = readSnapshots();
      const linkedIds = new Set(linked.map((task) => task.id));
      let snapshotsChanged = false;
      for (const id of Object.keys(snapshots)) {
        if (!linkedIds.has(id)) {
          delete snapshots[id];
          snapshotsChanged = true;
        }
      }
      if (!linked.length) {
        if (snapshotsChanged) writeSnapshots(snapshots);
        setGone((current) => (current.length ? [] : current));
        if (changedPhone) notifyCalendarChanged();
        return;
      }

      const found = new Map<string, RawDeviceEvent>();
      try {
        const ids = [...new Set(linked.map((task) => task.calendarEventId as string))];
        for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
          for (const event of await getDeviceEvents(ids.slice(i, i + LOOKUP_CHUNK))) found.set(event.id, event);
        }
      } catch {
        // The lookup failed, which says nothing about the events themselves, so change nothing.
        return;
      }

      const patches = new Map<string, { eventId: string; patch: Partial<Task> }>();
      const missing: Task[] = [];

      for (const task of linked) {
        const eventId = task.calendarEventId as string;
        const event = found.get(eventId);
        if (!event) {
          // Only a link this phone made is trusted to mean "deleted"; an older link is left alone.
          if (task.calendarDeviceId === deviceId && !deferred.current.has(task.id)) missing.push(task);
          continue;
        }
        if (!isSameCalendar(task, event)) continue;

        const result = reconcile(task, event, snapshots[task.id] ?? null, event.writable);
        const patch: Partial<Task> = { ...result.taskPatch };
        if (!task.calendarDeviceId) patch.calendarDeviceId = deviceId;

        let pushed = true;
        if (hasChanges(result.eventChanges)) {
          try {
            pushed = await updateDeviceEvent(eventId, result.eventChanges);
            if (pushed) changedPhone = true;
          } catch {
            pushed = false;
          }
        }
        if (pushed) {
          snapshots[task.id] = result.snapshot;
          snapshotsChanged = true;
        }
        if (hasChanges(patch)) patches.set(task.id, { eventId, patch });
      }

      if (snapshotsChanged) writeSnapshots(snapshots);
      if (patches.size) {
        setTasks((prev) =>
          prev.map((task) => {
            const change = patches.get(task.id);
            return change && task.calendarEventId === change.eventId ? { ...task, ...change.patch } : task;
          }),
        );
      }
      setGone((current) => {
        const same = current.length === missing.length && current.every((task, i) => task.id === missing[i].id);
        return same ? current : missing;
      });
      if (changedPhone) notifyCalendarChanged();
    }
  }, [supported, tasksRef, setTasks]);

  // When the app opens and whenever it returns to the foreground.
  useEffect(() => {
    if (!supported) return;
    const timer = window.setTimeout(() => void runSync(), 1200);
    const refresh = () => {
      if (document.visibilityState === 'visible') void runSync();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [supported, runSync]);

  // Shortly after a linked task is edited, so the change reaches the phone calendar without waiting.
  const signature = syncSignature(tasks);
  useEffect(() => {
    if (!supported || !signature) return;
    const timer = window.setTimeout(() => void runSync(), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [supported, signature, runSync]);

  /** Call after tasks are deleted in the app: their events are deleted from the phone calendar too. */
  const releaseEvents = useCallback(
    (removed: Task[]) => {
      if (!supported) return;
      const deviceId = getCalendarDeviceId();
      const targets = removed.filter((task) => isLinkedHere(task, deviceId));
      if (!targets.length) return;
      void (async () => {
        const snapshots = readSnapshots();
        const failed = [...readPendingDeletes()];
        let deleted = false;
        for (const task of targets) {
          delete snapshots[task.id];
          try {
            deleted = (await deleteDeviceEvent(task.calendarEventId as string)) || deleted;
          } catch {
            failed.push({ eventId: task.calendarEventId as string, calendarId: task.calendarId ?? '' });
          }
        }
        writeSnapshots(snapshots);
        writePendingDeletes(failed);
        if (deleted) notifyCalendarChanged();
      })();
    },
    [supported],
  );

  /** The user chose to keep a task whose event is gone: it stops being linked. */
  const keepWithoutEvent = useCallback(
    (taskId: string) => {
      deferred.current.add(taskId);
      setGone((current) => current.filter((task) => task.id !== taskId));
      setTasks((prev) => prev.map((task) => (task.id === taskId ? withoutCalendarLink(task) : task)));
    },
    [setTasks],
  );

  /** Ask again later (next app launch) instead of now. */
  const askLater = useCallback((taskId: string) => {
    deferred.current.add(taskId);
    setGone((current) => current.filter((task) => task.id !== taskId));
  }, []);

  return { gone, releaseEvents, keepWithoutEvent, askLater };
}

function notifyCalendarChanged() {
  window.dispatchEvent(new Event(CALENDAR_CHANGED_EVENT));
}

/** Deletes events that an earlier delete could not remove (permission off, calendar busy). */
async function retryPendingDeletes(): Promise<boolean> {
  const pending = readPendingDeletes();
  if (!pending.length) return false;
  const stillPending = [];
  let deleted = false;
  for (const item of pending) {
    try {
      deleted = (await deleteDeviceEvent(item.eventId)) || deleted;
    } catch {
      stillPending.push(item);
    }
  }
  writePendingDeletes(stillPending);
  return deleted;
}
