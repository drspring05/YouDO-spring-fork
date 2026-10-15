import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALENDAR_DEFAULT_VIEW_KEY, normalizeCalendarView, readCalendarDefaultView } from './calendarPrefs';

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
    expect(normalizeCalendarView('year')).toBe('month');
    expect(normalizeCalendarView(undefined)).toBe('month');
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
