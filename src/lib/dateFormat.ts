import { useSyncExternalStore } from 'react';
import { readStorageRaw } from './storageKeys';

/**
 * How the calendar writes dates. "auto" keeps whatever the phone's language uses; the others fix the order of
 * day, month and year everywhere the Spring Fork screens show a date. It is a per-phone display choice:
 * stored dates themselves stay YYYY-MM-DD.
 */
export type DateOrder = 'auto' | 'dmy' | 'mdy' | 'ymd';

export const DATE_FORMAT_KEY = 'youdo-date-format-v1';
export const DATE_FORMAT_EVENT = 'youdo-date-format-changed';

export const DATE_FORMAT_OPTIONS: { value: DateOrder; label: string }[] = [
  { value: 'auto', label: 'Phone default' },
  { value: 'dmy', label: 'DD/MM/YYYY' },
  { value: 'mdy', label: 'MM/DD/YYYY' },
  { value: 'ymd', label: 'YYYY-MM-DD' },
];

export function normalizeDateOrder(value: unknown): DateOrder {
  return value === 'dmy' || value === 'mdy' || value === 'ymd' ? value : 'auto';
}

export function readDateFormat(): DateOrder {
  try {
    const raw = readStorageRaw(DATE_FORMAT_KEY);
    return raw === null ? 'auto' : normalizeDateOrder(JSON.parse(raw));
  } catch {
    return 'auto';
  }
}

export function writeDateFormat(order: DateOrder): void {
  try {
    localStorage.setItem(DATE_FORMAT_KEY, JSON.stringify(normalizeDateOrder(order)));
  } catch {
    /* kept in memory only for this run */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DATE_FORMAT_EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(DATE_FORMAT_EVENT, listener);
  return () => window.removeEventListener(DATE_FORMAT_EVENT, listener);
}

/** The chosen order; screens using it redraw when it changes. */
export function useDateFormat(): DateOrder {
  return useSyncExternalStore(subscribe, readDateFormat, () => 'auto' as DateOrder);
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** 23/10/2026, 10/23/2026 or 2026-10-23. With "auto", the phone's own numeric style. */
export function formatDateNumeric(value: string | Date, order: DateOrder = readDateFormat()): string {
  const d = toDate(value);
  if (!d) return typeof value === 'string' ? value : '';
  const [y, m, day] = [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())];
  if (order === 'dmy') return `${day}/${m}/${y}`;
  if (order === 'mdy') return `${m}/${day}/${y}`;
  if (order === 'ymd') return `${y}-${m}-${day}`;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export type DateLabelKind = 'short' | 'weekdayShort' | 'weekdayLong' | 'full';

/**
 * A date written with a month name: "23 Oct", "Fri, Oct 23", "Friday, 23 Oct 2026" and so on, with the day
 * and month in the chosen order. With "auto" it is exactly what the phone's language produced before.
 */
export function formatDateLabel(value: string | Date, kind: DateLabelKind, order: DateOrder = readDateFormat()): string {
  const d = toDate(value);
  if (!d) return typeof value === 'string' ? value : '';
  if (order === 'auto') {
    if (kind === 'short') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (kind === 'weekdayShort') return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (kind === 'weekdayLong') return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return d.toLocaleDateString(undefined, { dateStyle: 'full' });
  }
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const day = String(d.getDate());
  const year = String(d.getFullYear());
  const weekday = (style: 'short' | 'long') => d.toLocaleDateString(undefined, { weekday: style });
  const md = order === 'mdy' ? `${month} ${day}` : order === 'ymd' ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${day} ${month}`;
  if (kind === 'short') return md;
  if (kind === 'weekdayShort') return `${weekday('short')}, ${md}`;
  if (kind === 'weekdayLong') return `${weekday('long')}, ${md}`;
  const longMonth = d.toLocaleDateString(undefined, { month: 'long' });
  if (order === 'mdy') return `${weekday('long')}, ${longMonth} ${day}, ${year}`;
  if (order === 'ymd') return `${weekday('long')}, ${formatDateNumeric(d, 'ymd')}`;
  return `${weekday('long')}, ${day} ${longMonth} ${year}`;
}
