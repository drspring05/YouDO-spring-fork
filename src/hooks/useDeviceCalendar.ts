import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDeviceCalendarPermission,
  listRawDeviceEvents,
  openDeviceCalendarSettings,
  requestDeviceCalendarAccess,
  supportsDeviceCalendar,
  type CalendarPermissionState,
} from '../lib/nativeCalendar';
import { queryWindow, toDeviceEvents, type DeviceCalendarEvent } from '../lib/deviceCalendar';

export type DeviceCalendarAccess = 'unsupported' | 'checking' | CalendarPermissionState;

/**
 * Phone-calendar events between two local days (YYYY-MM-DD, inclusive).
 * Reloads when the range changes and when the app returns to the foreground, so edits made in the
 * phone's Calendar app show up without restarting YouDO.
 */
export function useDeviceCalendar(startDate: string, endDate: string) {
  const supported = supportsDeviceCalendar();
  const [access, setAccess] = useState<DeviceCalendarAccess>(supported ? 'checking' : 'unsupported');
  const [events, setEvents] = useState<DeviceCalendarEvent[]>([]);
  const [error, setError] = useState('');
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!supported) return;
    const run = ++latest.current;
    try {
      const state = await getDeviceCalendarPermission();
      if (run !== latest.current) return;
      setAccess(state);
      if (state !== 'granted') {
        setEvents([]);
        return;
      }
      const { start, end } = queryWindow(startDate, endDate);
      const rows = await listRawDeviceEvents(start, end);
      if (run !== latest.current) return;
      setEvents(toDeviceEvents(rows));
      setError('');
    } catch (cause) {
      if (run !== latest.current) return;
      setError(cause instanceof Error ? cause.message : 'Could not read your calendar.');
    }
  }, [supported, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!supported) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [supported, load]);

  const requestAccess = useCallback(async () => {
    try {
      const state = await requestDeviceCalendarAccess();
      setAccess(state);
      if (state === 'granted') await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not ask for calendar access.');
    }
  }, [load]);

  const openSettings = useCallback(async () => {
    try {
      await openDeviceCalendarSettings();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open Android settings.');
    }
  }, []);

  return { supported, access, events, error, requestAccess, openSettings, refresh: load };
}
