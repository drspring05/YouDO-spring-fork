import { Capacitor, registerPlugin } from '@capacitor/core';

export type CalendarPermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
type PermissionAlias = 'readCalendar' | 'writeCalendar';
type PermissionStatus = Record<PermissionAlias, CalendarPermissionState>;

/** Shape returned by the Android plugin. Use `toDeviceEvent` before showing it. */
export interface RawDeviceEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  /** epoch ms. For all-day events these are UTC midnights and `end` is exclusive. */
  begin: number;
  end: number;
  color: string;
  writable: boolean;
  /** True for a repeating event (the series itself, not a single edited occurrence). */
  recurring?: boolean;
}

export interface DeviceCalendar {
  id: string;
  name: string;
  accountName: string;
  color: string;
  writable: boolean;
  visible: boolean;
}

/** What the Android plugin needs to put one event on a calendar. Same epoch rules as `RawDeviceEvent`. */
export interface NewDeviceEvent {
  calendarId: string;
  title: string;
  description: string;
  allDay: boolean;
  begin: number;
  end: number;
  /** "#RRGGBB" for the event's own color. Left out, the event takes its calendar's color. */
  color?: string;
}

/** Fields of an existing event that can be changed. Anything left out stays as it is. */
export interface DeviceEventChanges {
  title?: string;
  description?: string;
  location?: string;
  /** "#RRGGBB" sets the event's own color; null goes back to the calendar's color. */
  color?: string | null;
  allDay?: boolean;
  /** epoch ms, same rules as `RawDeviceEvent`. Send `allDay`, `begin` and `end` together. */
  begin?: number;
  end?: number;
}

interface YouDoCalendarPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(options?: { permissions: PermissionAlias[] }): Promise<PermissionStatus>;
  listCalendars(): Promise<{ calendars: DeviceCalendar[] }>;
  listEvents(options: { start: number; end: number }): Promise<{ events: RawDeviceEvent[]; truncated: boolean }>;
  getEvents(options: { ids: string[] }): Promise<{ events: RawDeviceEvent[] }>;
  createEvent(options: NewDeviceEvent): Promise<{ id: string }>;
  updateEvent(options: DeviceEventChanges & { id: string }): Promise<{ updated: boolean }>;
  deleteEvent(options: { id: string }): Promise<{ deleted: boolean }>;
  deleteOccurrence(options: { id: string; begin: number }): Promise<{ deleted: boolean }>;
  openAppSettings(): Promise<void>;
}

const YouDoCalendar = registerPlugin<YouDoCalendarPlugin>('YouDoCalendar');

/** The phone calendar bridge only exists in the Android app. */
export const supportsDeviceCalendar = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('YouDoCalendar');

export async function getDeviceCalendarPermission(): Promise<CalendarPermissionState> {
  return (await YouDoCalendar.checkPermissions()).readCalendar;
}

/** Android groups read and write into one prompt, so both are requested together. */
export async function requestDeviceCalendarAccess(): Promise<CalendarPermissionState> {
  return (await YouDoCalendar.requestPermissions({ permissions: ['readCalendar', 'writeCalendar'] })).readCalendar;
}

export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  return (await YouDoCalendar.listCalendars()).calendars;
}

export async function listRawDeviceEvents(start: number, end: number): Promise<RawDeviceEvent[]> {
  return (await YouDoCalendar.listEvents({ start, end })).events;
}

/**
 * Looks events up by id, whatever date they are on. An id that is missing from the result no longer
 * exists on the phone (deleted, or its calendar was removed).
 */
export async function getDeviceEvents(ids: string[]): Promise<RawDeviceEvent[]> {
  if (!ids.length) return [];
  return (await YouDoCalendar.getEvents({ ids })).events;
}

/** Adds an event to the phone calendar and returns its id. */
export async function createDeviceEvent(event: NewDeviceEvent): Promise<string> {
  return (await YouDoCalendar.createEvent(event)).id;
}

/** Changes the event itself (the whole series, for a repeating event). Resolves false when the event is gone. */
export async function updateDeviceEvent(id: string, changes: DeviceEventChanges): Promise<boolean> {
  return (await YouDoCalendar.updateEvent({ ...changes, id })).updated;
}

/** Resolves true when an event was removed, false when it was already gone. */
export async function deleteDeviceEvent(id: string): Promise<boolean> {
  return (await YouDoCalendar.deleteEvent({ id })).deleted;
}

/**
 * Deletes one occurrence of a repeating event and keeps the rest of the series. `begin` is that
 * occurrence's own start (the `begin` of the event as listed). Resolves false when the event was already gone.
 */
export async function deleteDeviceOccurrence(id: string, begin: number): Promise<boolean> {
  return (await YouDoCalendar.deleteOccurrence({ id, begin })).deleted;
}

export async function openDeviceCalendarSettings(): Promise<void> {
  await YouDoCalendar.openAppSettings();
}
