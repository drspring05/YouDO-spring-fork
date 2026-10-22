import { describe, expect, it } from 'vitest';
import { formatDateLabel, formatDateNumeric, normalizeDateOrder } from './dateFormat';

describe('date format', () => {
  it('writes numeric dates in the chosen order', () => {
    expect(formatDateNumeric('2026-10-23', 'dmy')).toBe('23/10/2026');
    expect(formatDateNumeric('2026-10-23', 'mdy')).toBe('10/23/2026');
    expect(formatDateNumeric('2026-10-23', 'ymd')).toBe('2026-10-23');
  });
  it('puts the day before the month for DD/MM and after it for MM/DD in labels', () => {
    expect(formatDateLabel('2026-10-23', 'short', 'dmy')).toMatch(/^23 /);
    expect(formatDateLabel('2026-10-23', 'short', 'mdy')).toMatch(/ 23$/);
    expect(formatDateLabel('2026-10-23', 'full', 'ymd')).toContain('2026-10-23');
  });
  it('falls back to the phone default for anything unknown', () => {
    expect(normalizeDateOrder('nope')).toBe('auto');
    expect(normalizeDateOrder(undefined)).toBe('auto');
    expect(normalizeDateOrder('dmy')).toBe('dmy');
  });
  it('leaves text it cannot read alone', () => {
    expect(formatDateNumeric('soon', 'dmy')).toBe('soon');
  });
});
