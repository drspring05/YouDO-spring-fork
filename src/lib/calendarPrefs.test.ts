import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CALENDAR_DEFAULT_VIEW_KEY,
  CALENDAR_HIDDEN_KEY,
  normalizeCalendarView,
  normalizeHiddenCalendars,
  readCalendarDefaultView,
  readHiddenCalendarIds,
} from './calendarPrefs';

const stubStorage = (initial: Record<string, string> = {}) => {
  const saved = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
};

describe('calendar default view', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to Month for unknown values', () => {
    expect(normalizeCalendarView('agenda')).toBe('agenda');
    expect(normalizeCalendarView('week')).toBe('week');
    expect(normalizeCalendarView('month')).toBe('month');
    expect(normalizeCalendarView('year')).toBe('year');
    expect(normalizeCalendarView('day')).toBe('month');
    expect(normalizeCalendarView(undefined)).toBe('month');
  });

  it('reads Year as the saved choice', () => {
    stubStorage({ [CALENDAR_DEFAULT_VIEW_KEY]: JSON.stringify('year') });
    expect(readCalendarDefaultView()).toBe('year');
  });

  it('defaults to Month when nothing is saved', () => {
    stubStorage();
    expect(readCalendarDefaultView()).toBe('month');
  });

  it('reads the saved choice', () => {
    stubStorage({ [CALENDAR_DEFAULT_VIEW_KEY]: JSON.stringify('agenda') });
    expect(readCalendarDefaultView()).toBe('agenda');
  });

  it('survives corrupt or blocked storage', () => {
    stubStorage({ [CALENDAR_DEFAULT_VIEW_KEY]: '{not json' });
    expect(readCalendarDefaultView()).toBe('month');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readCalendarDefaultView()).toBe('month');
  });
});

describe('hidden calendars', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps only non-empty text ids, once each', () => {
    expect(normalizeHiddenCalendars(['3', '3', '', 7, null, '12'])).toEqual(['3', '12']);
    expect(normalizeHiddenCalendars('3')).toEqual([]);
    expect(normalizeHiddenCalendars(undefined)).toEqual([]);
  });

  it('shows every calendar when nothing is saved', () => {
    stubStorage();
    expect(readHiddenCalendarIds()).toEqual([]);
  });

  it('reads the saved list', () => {
    stubStorage({ [CALENDAR_HIDDEN_KEY]: JSON.stringify(['4', '9']) });
    expect(readHiddenCalendarIds()).toEqual(['4', '9']);
  });

  it('survives corrupt or blocked storage', () => {
    stubStorage({ [CALENDAR_HIDDEN_KEY]: '{not json' });
    expect(readHiddenCalendarIds()).toEqual([]);
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
    expect(readHiddenCalendarIds()).toEqual([]);
  });
});
