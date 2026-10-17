import { describe, expect, it } from 'vitest';
import type { GoalNode, Task } from '../types';
import { normalizeImportedGoal } from './backup';
import { diffBlueprintSteps } from './blueprintStudio';
import {
  alignStepDates,
  datedStepIndicesOn,
  dayRange,
  daysInRangeForMonth,
  inDayRange,
  isIsoDay,
  monthsInRange,
  normalizeStepDates,
  shiftStepDates,
  stepDateAfterWheel,
  stepIndicesForDay,
  taskStepDates,
  wheelPositions,
} from './stepDates';

const range = dayRange('2026-10-18', '2026-10-25');
const crossing = dayRange('2026-10-29', '2026-11-03');

describe('isIsoDay and dayRange', () => {
  it('accepts real days only', () => {
    expect(isIsoDay('2026-10-18')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('18/10/2026')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });
  it('treats a missing or earlier end as a single day', () => {
    expect(dayRange('2026-10-18')).toEqual({ start: '2026-10-18', end: '2026-10-18' });
    expect(dayRange('2026-10-18', '2026-10-10')).toEqual({ start: '2026-10-18', end: '2026-10-18' });
    expect(dayRange('2026-10-18', '2026-10-25').end).toBe('2026-10-25');
  });
  it('knows whether a day is inside the range', () => {
    expect(inDayRange('2026-10-18', range)).toBe(true);
    expect(inDayRange('2026-10-25', range)).toBe(true);
    expect(inDayRange('2026-10-26', range)).toBe(false);
    expect(inDayRange('2026-10-17', range)).toBe(false);
  });
});

describe('months and days offered by the wheels', () => {
  it('offers one month and only the days inside the timeframe', () => {
    expect(monthsInRange(range)).toEqual([{ year: 2026, month: 9 }]);
    expect(daysInRangeForMonth(range, 2026, 9)).toEqual([18, 19, 20, 21, 22, 23, 24, 25]);
  });
  it('offers both months when the timeframe crosses a month, each with its own days', () => {
    expect(monthsInRange(crossing)).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ]);
    expect(daysInRangeForMonth(crossing, 2026, 9)).toEqual([29, 30, 31]);
    expect(daysInRangeForMonth(crossing, 2026, 10)).toEqual([1, 2, 3]);
  });
  it('handles a timeframe that crosses a year', () => {
    const newYear = dayRange('2026-12-30', '2027-01-02');
    expect(monthsInRange(newYear)).toEqual([
      { year: 2026, month: 11 },
      { year: 2027, month: 0 },
    ]);
    expect(daysInRangeForMonth(newYear, 2027, 0)).toEqual([1, 2]);
  });
  it('caps a runaway timeframe', () => {
    expect(monthsInRange(dayRange('2026-01-01', '2099-12-31')).length).toBeLessThanOrEqual(36);
  });
});

describe('wheelPositions', () => {
  it('shows the placeholder when the step has no day', () => {
    expect(wheelPositions(null, range)).toMatchObject({ monthPos: 0, dayPos: 0 });
    expect(wheelPositions('2026-12-01', range)).toMatchObject({ monthPos: 0, dayPos: 0 });
  });
  it('puts a chosen day at its list index plus one', () => {
    expect(wheelPositions('2026-10-20', range)).toMatchObject({ monthPos: 1, dayPos: 3 });
    expect(wheelPositions('2026-11-02', crossing)).toMatchObject({ monthPos: 2, dayPos: 2 });
  });
});

describe('stepDateAfterWheel', () => {
  it('scrolling the day wheel off the placeholder sets a day in the first month', () => {
    expect(stepDateAfterWheel(null, range, 'day', 1)).toBe('2026-10-18');
    expect(stepDateAfterWheel(null, range, 'day', 8)).toBe('2026-10-25');
  });
  it('scrolling the month wheel off the placeholder picks that month at its first day', () => {
    expect(stepDateAfterWheel(null, crossing, 'month', 2)).toBe('2026-11-01');
  });
  it('keeps the day number when the new month has it, else the day closest in time', () => {
    const long = dayRange('2026-10-18', '2026-11-25');
    expect(stepDateAfterWheel('2026-10-20', long, 'month', 2)).toBe('2026-11-20');
    expect(stepDateAfterWheel('2026-10-30', crossing, 'month', 2)).toBe('2026-11-01');
    expect(stepDateAfterWheel('2026-11-02', crossing, 'month', 1)).toBe('2026-10-31');
  });
  it('sets the day inside the month already chosen', () => {
    expect(stepDateAfterWheel('2026-11-01', crossing, 'day', 3)).toBe('2026-11-03');
  });
  it('going back to the placeholder removes the date', () => {
    expect(stepDateAfterWheel('2026-10-20', range, 'day', 0)).toBeNull();
    expect(stepDateAfterWheel('2026-10-20', range, 'month', 0)).toBeNull();
  });
  it('never returns a day outside the timeframe', () => {
    for (let pos = 1; pos < 50; pos += 1) {
      for (const wheel of ['month', 'day'] as const) {
        const next = stepDateAfterWheel('2026-10-20', range, wheel, pos);
        if (next) expect(inDayRange(next, range)).toBe(true);
      }
    }
  });
});

describe('stored lists', () => {
  it('normalizes old and damaged data without throwing', () => {
    expect(normalizeStepDates(undefined, 3)).toBeUndefined();
    expect(normalizeStepDates('nope', 3)).toBeUndefined();
    expect(normalizeStepDates([null, null], 2)).toBeUndefined();
    expect(normalizeStepDates(['2026-10-20', 'junk', 5], 4)).toEqual(['2026-10-20', null, null, null]);
    expect(normalizeStepDates(['2026-10-20', '2026-10-21', '2026-10-22'], 2)).toEqual(['2026-10-20', '2026-10-21']);
  });
  it('aligns a list after steps were edited', () => {
    expect(alignStepDates(['2026-10-20'], 3)).toEqual(['2026-10-20', null, null]);
    expect(alignStepDates(undefined, 3)).toBeUndefined();
  });
  it('shifts every date by the same number of days', () => {
    expect(shiftStepDates(['2026-10-20', null, '2026-10-22'], 3)).toEqual(['2026-10-23', null, '2026-10-25']);
    expect(shiftStepDates(undefined, 3)).toBeUndefined();
    expect(shiftStepDates([null], 3)).toBeUndefined();
  });
});

const node = (over: Partial<GoalNode>): GoalNode => ({
  id: 'n1',
  kind: 'node',
  title: 'Task',
  children: [],
  createdAt: 0,
  ...over,
});
const task = (over: Partial<Task>): Task => ({
  id: 't1',
  title: 'Task',
  description: '',
  priority: 'medium',
  targetDate: '2026-10-18',
  deadline: null,
  steps: [],
  progress: 0,
  createdAt: 0,
  order: 0,
  goalNodeId: 'n1',
  ...over,
});

describe('taskStepDates', () => {
  const goal = node({ steps: ['a', 'b', 'c'], stepDates: ['2026-10-19', null, '2026-10-24'] });

  it('has no dates for an old item with none', () => {
    const plain = node({ steps: ['a', 'b'] });
    expect(taskStepDates(task({ steps: ['a', 'b'], endDate: '2026-10-25' }), plain)).toEqual([null, null]);
  });
  it('reads the dates in the task order for a full plan', () => {
    const t = task({ steps: ['a', 'b', 'c'], endDate: '2026-10-25' });
    expect(taskStepDates(t, goal)).toEqual(['2026-10-19', null, '2026-10-24']);
  });
  it('follows the step slice when the task carries only some steps', () => {
    const t = task({ steps: ['a', 'c'], stepSlice: [0, 2], endDate: '2026-10-25' });
    expect(taskStepDates(t, goal)).toEqual(['2026-10-19', '2026-10-24']);
  });
  it('ignores a date outside the timeframe, so the step follows the task', () => {
    const t = task({ steps: ['a', 'b', 'c'], endDate: '2026-10-21' });
    expect(taskStepDates(t, goal)).toEqual(['2026-10-19', null, null]);
  });
  it('has no dates without the matching goal item', () => {
    expect(taskStepDates(task({ steps: ['a'] }), null)).toEqual([null]);
    expect(taskStepDates(task({ steps: ['a'], goalNodeId: 'other' }), goal)).toEqual([null]);
  });
});

describe('which steps belong on a day', () => {
  const dates = ['2026-10-19', null, '2026-10-24'];
  it('lists the steps dated that day plus the undated ones', () => {
    expect(stepIndicesForDay(dates, '2026-10-19')).toEqual([0, 1]);
    expect(stepIndicesForDay(dates, '2026-10-24')).toEqual([1, 2]);
    expect(stepIndicesForDay(dates, '2026-10-20')).toEqual([1]);
  });
  it('finds only the steps dated exactly on a day', () => {
    expect(datedStepIndicesOn(dates, '2026-10-24')).toEqual([2]);
    expect(datedStepIndicesOn(dates, '2026-10-20')).toEqual([]);
  });
});

describe('step dates survive backups and step edits', () => {
  it('keeps real days from a backup and drops the rest', () => {
    const goal = normalizeImportedGoal({
      id: 'g1',
      title: 'Goal',
      kind: 'node',
      steps: ['a', 'b', 'c'],
      stepDates: ['2026-10-19', 'junk', null],
    });
    expect(goal?.stepDates).toEqual(['2026-10-19', null, null]);
  });
  it('loads an old backup that has no step dates', () => {
    const goal = normalizeImportedGoal({ id: 'g1', title: 'Goal', kind: 'node', steps: ['a', 'b'] });
    expect(goal?.stepDates).toBeUndefined();
  });
  it('ignores step dates on an item with no steps', () => {
    const goal = normalizeImportedGoal({ id: 'g1', title: 'Goal', kind: 'node', stepDates: ['2026-10-19'] });
    expect(goal?.stepDates).toBeUndefined();
  });
  it('keeps each step with its day when steps are removed or added in bulk', () => {
    const root = node({
      id: 'r1',
      kind: 'node',
      steps: ['a', 'b', 'c'],
      stepDone: [false, false, false],
      stepDates: ['2026-10-19', null, '2026-10-24'],
    });
    const result = diffBlueprintSteps([root], ['r1'], ['d'], ['b']);
    expect(result.goals[0].steps).toEqual(['a', 'c', 'd']);
    expect(result.goals[0].stepDates).toEqual(['2026-10-19', '2026-10-24', null]);
  });
});
