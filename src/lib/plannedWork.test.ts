import { describe, expect, it } from 'vitest';
import {
  daysAllotted,
  originChipNames,
  searchGoals,
  shouldRelinkAfterUnfinish,
  shouldReleaseOnFinish,
  taskLastDay,
  upcomingTaskGroups,
} from './plannedWork';
import type { GoalNode, Task } from '../types';

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Task',
  description: '',
  priority: 'medium',
  targetDate: '2026-10-20',
  deadline: null,
  steps: [],
  progress: 0,
  createdAt: 0,
  order: 0,
  ...over,
});

const node = (id: string, title: string, children: GoalNode[] = [], over: Partial<GoalNode> = {}): GoalNode => ({
  id,
  kind: 'node',
  title,
  children,
  createdAt: 0,
  completed: false,
  ...over,
});

describe('taskLastDay', () => {
  it('is the first day without a timeframe, the end day with one', () => {
    expect(taskLastDay({ targetDate: '2026-10-20' })).toBe('2026-10-20');
    expect(taskLastDay({ targetDate: '2026-10-20', endDate: '2026-10-25' })).toBe('2026-10-25');
    expect(taskLastDay({ targetDate: '2026-10-20', endDate: '2026-10-18' })).toBe('2026-10-20');
    expect(taskLastDay({})).toBeNull();
  });
});

describe('shouldReleaseOnFinish', () => {
  const linked = { calendarEventId: 'e1' };
  it('releases a finished task whose last day is today or later', () => {
    expect(shouldReleaseOnFinish(task({ ...linked, progress: 1 }), '2026-10-20')).toBe(true);
    expect(shouldReleaseOnFinish(task({ ...linked, progress: 1 }), '2026-10-19')).toBe(true);
  });
  it('keeps the calendar history of old finished tasks', () => {
    expect(shouldReleaseOnFinish(task({ ...linked, progress: 1 }), '2026-10-21')).toBe(false);
  });
  it('still releases a late catch-up of a missed task', () => {
    expect(shouldReleaseOnFinish(task({ ...linked, progress: 1, originalTargetDate: '2026-10-10' }), '2026-10-21')).toBe(true);
  });
  it('waits for a multi-day task to finish its last day', () => {
    expect(shouldReleaseOnFinish(task({ ...linked, progress: 1, endDate: '2026-10-25' }), '2026-10-22')).toBe(true);
    expect(shouldReleaseOnFinish(task({ ...linked, progress: 1, endDate: '2026-10-25' }), '2026-10-26')).toBe(false);
  });
  it('does nothing for open tasks or tasks without an event', () => {
    expect(shouldReleaseOnFinish(task({ ...linked }), '2026-10-20')).toBe(false);
    expect(shouldReleaseOnFinish(task({ progress: 1 }), '2026-10-20')).toBe(false);
    expect(shouldReleaseOnFinish(task({ ...linked, steps: ['a', 'b'], progress: 1 }), '2026-10-20')).toBe(false);
    expect(shouldReleaseOnFinish(task({ ...linked, steps: ['a', 'b'], progress: 2 }), '2026-10-20')).toBe(true);
  });
});

describe('shouldRelinkAfterUnfinish', () => {
  it('brings the event back only for a task released by finishing and open again', () => {
    expect(shouldRelinkAfterUnfinish(task({ calendarFinished: true }))).toBe(true);
    expect(shouldRelinkAfterUnfinish(task({ calendarFinished: true, progress: 1 }))).toBe(false);
    expect(shouldRelinkAfterUnfinish(task({ calendarFinished: true, calendarEventId: 'e' }))).toBe(false);
    expect(shouldRelinkAfterUnfinish(task())).toBe(false);
    expect(shouldRelinkAfterUnfinish(task({ calendarFinished: true, targetDate: undefined }))).toBe(false);
  });
});

describe('originChipNames', () => {
  it('shows the goal name and the last two branches', () => {
    expect(originChipNames(['Goal', 'A', 'B', 'C', 'D'])).toEqual(['Goal', 'C', 'D']);
    expect(originChipNames(['Goal', 'A', 'B', 'C'])).toEqual(['Goal', 'B', 'C']);
  });
  it('keeps short paths whole and drops blanks', () => {
    expect(originChipNames(['Goal', 'A', 'B'])).toEqual(['Goal', 'A', 'B']);
    expect(originChipNames(['Goal'])).toEqual(['Goal']);
    expect(originChipNames([])).toEqual([]);
    expect(originChipNames(['Goal', ' ', 'A'])).toEqual(['Goal', 'A']);
  });
});

describe('daysAllotted', () => {
  it('counts the days between the dates, like "days left"', () => {
    expect(daysAllotted('2026-09-02', '2027-07-01')).toBe(302);
    expect(daysAllotted('2026-09-02', '2026-09-04')).toBe(2);
  });
  it('counts a one-day range as 1 day', () => {
    expect(daysAllotted('2026-09-02', '2026-09-02')).toBe(1);
  });
  it('is null without both dates or when backwards', () => {
    expect(daysAllotted('2026-09-02', undefined)).toBeNull();
    expect(daysAllotted(undefined, '2026-09-02')).toBeNull();
    expect(daysAllotted('2026-09-05', '2026-09-02')).toBeNull();
  });
});

describe('upcomingTaskGroups', () => {
  it('groups open future tasks by day, earliest first', () => {
    const groups = upcomingTaskGroups(
      [
        task({ id: 'a', targetDate: '2026-10-25', order: 1 }),
        task({ id: 'b', targetDate: '2026-10-21', order: 2 }),
        task({ id: 'c', targetDate: '2026-10-25', order: 0 }),
      ],
      '2026-10-20',
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-10-21', '2026-10-25']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['c', 'a']);
  });
  it('leaves out today, the past, finished and undated tasks', () => {
    const groups = upcomingTaskGroups(
      [
        task({ id: 'today', targetDate: '2026-10-20' }),
        task({ id: 'past', targetDate: '2026-10-10' }),
        task({ id: 'done', targetDate: '2026-10-22', progress: 1 }),
        task({ id: 'none', targetDate: undefined }),
        task({ id: 'ok', targetDate: '2026-10-22' }),
      ],
      '2026-10-20',
    );
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(['ok']);
  });
});

describe('searchGoals', () => {
  const tree = [
    node('g1', 'Fitness', [
      node('b1', 'Strength', [node('t1', 'Squat day', [], { steps: ['warm up', 'sets'] })]),
      node('b2', 'Cardio', [node('t2', 'Run 5k', [], { description: 'easy squat pace' })]),
    ]),
    node('g2', 'Squat research'),
  ];

  it('finds goals, branches and tasks by title with their path', () => {
    const hits = searchGoals(tree, 'cardio');
    expect(hits).toHaveLength(1);
    expect(hits[0].role).toBe('Branch');
    expect(hits[0].pathIds).toEqual(['g1', 'b2']);
    expect(hits[0].ancestors.map((a) => a.title)).toEqual(['Fitness']);
  });

  it('ranks titles that start with the text first (tree order), then other titles, then descriptions', () => {
    const ids = searchGoals(tree, 'squat').map((h) => h.node.id);
    expect(ids).toEqual(['t1', 'g2', 't2']);
  });

  it('is case-insensitive, needs every word, and returns nothing for blank text', () => {
    expect(searchGoals(tree, 'RUN 5K').map((h) => h.node.id)).toEqual(['t2']);
    expect(searchGoals(tree, 'run squat').map((h) => h.node.id)).toEqual(['t2']);
    expect(searchGoals(tree, '   ')).toEqual([]);
    expect(searchGoals(tree, 'zzz')).toEqual([]);
  });

  it('labels a top-level item a goal and a leaf a task', () => {
    expect(searchGoals(tree, 'fitness')[0].role).toBe('Goal');
    expect(searchGoals(tree, 'squat day')[0].role).toBe('Task');
  });
});
