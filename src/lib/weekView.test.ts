import { describe, expect, it } from 'vitest';
import {
  WEEK_NOTE_MAX_LENGTH,
  normalizeWeekNotes,
  weekCells,
  weekDaysOf,
  weekRangeLabel,
  weekStartOf,
  withWeekNote,
} from './weekView';

describe('week days', () => {
  it('starts the week on Sunday', () => {
    expect(weekStartOf('2026-10-15')).toBe('2026-10-11'); // a Thursday
    expect(weekStartOf('2026-10-11')).toBe('2026-10-11'); // the Sunday itself
    expect(weekStartOf('2026-10-17')).toBe('2026-10-11'); // the Saturday
  });

  it('lists seven days and crosses month and year ends', () => {
    expect(weekDaysOf('2026-10-15')).toEqual([
      '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17',
    ]);
    expect(weekDaysOf('2026-12-31')).toEqual([
      '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ]);
  });
});

describe('weekCells', () => {
  it('fills a 2×4 grid with the notes cell last', () => {
    const cells = weekCells('2026-10-15');
    expect(cells).toHaveLength(8);
    expect(cells.slice(0, 7).every((cell) => cell.kind === 'day')).toBe(true);
    expect(cells[0]).toEqual({ kind: 'day', date: '2026-10-11', weekdayIndex: 0 });
    expect(cells[6]).toEqual({ kind: 'day', date: '2026-10-17', weekdayIndex: 6 });
    expect(cells[7]).toEqual({ kind: 'notes', weekStart: '2026-10-11' });
  });
});

describe('weekRangeLabel', () => {
  it('handles empty input', () => {
    expect(weekRangeLabel([])).toBe('');
  });

  it('shows the year once when the week stays inside it', () => {
    const label = weekRangeLabel(weekDaysOf('2026-10-15'));
    expect(label).toContain('2026');
    expect(label.match(/2026/g)).toHaveLength(1);
  });

  it('shows both years for a week that spans New Year', () => {
    const label = weekRangeLabel(weekDaysOf('2026-12-31'));
    expect(label).toContain('2026');
    expect(label).toContain('2027');
  });
});

describe('week notes', () => {
  it('drops malformed entries', () => {
    expect(normalizeWeekNotes(null)).toEqual({});
    expect(normalizeWeekNotes([])).toEqual({});
    expect(normalizeWeekNotes('text')).toEqual({});
    expect(
      normalizeWeekNotes({ '2026-10-11': 'hello', bad: 'x', '2026-10-18': 5, '2026-10-25': '' }),
    ).toEqual({ '2026-10-11': 'hello' });
  });

  it('clips very long notes', () => {
    const notes = normalizeWeekNotes({ '2026-10-11': 'a'.repeat(WEEK_NOTE_MAX_LENGTH + 50) });
    expect(notes['2026-10-11']).toHaveLength(WEEK_NOTE_MAX_LENGTH);
  });

  it('sets, replaces and clears one week without touching the others', () => {
    const start = { '2026-10-04': 'old week' };
    const added = withWeekNote(start, '2026-10-11', 'plan');
    expect(added).toEqual({ '2026-10-04': 'old week', '2026-10-11': 'plan' });
    expect(start).toEqual({ '2026-10-04': 'old week' });
    expect(withWeekNote(added, '2026-10-11', 'plan 2')['2026-10-11']).toBe('plan 2');
    expect(withWeekNote(added, '2026-10-11', '')).toEqual({ '2026-10-04': 'old week' });
  });
});
