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
}

interface YouDoCalendarPlugin {
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(options?: { permissions: PermissionAlias[] }): Promise<PermissionStatus>;
  listCalendars(): Promise<{ calendars: DeviceCalendar[] }>;
  listEvents(options: { start: number; end: number }): Promise<{ events: RawDeviceEvent[]; truncated: boolean }>;
  createEvent(options: NewDeviceEvent): Promise<{ id: string }>;
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

/** Adds an event to the phone calendar and returns its id. */
export async function createDeviceEvent(event: NewDeviceEvent): Promise<string> {
  return (await YouDoCalendar.createEvent(event)).id;
}

export async function openDeviceCalendarSettings(): Promise<void> {
  await YouDoCalendar.openAppSettings();
}
