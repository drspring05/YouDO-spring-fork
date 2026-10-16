import { describe, expect, it } from 'vitest';
import { desiredGoalEvents, goalEventWindow, planGoalSync, type GoalEventLink } from './goalCalendar';
import type { GoalNode } from '../types';

const DAY = 86_400_000;
const node = (id: string, over: Partial<GoalNode> = {}, children: GoalNode[] = []): GoalNode => ({
  id, kind: 'node', title: `Item ${id}`, children, createdAt: 0, ...over,
});

describe('goalEventWindow', () => {
  it('spans start to end inclusive', () => {
    const w = goalEventWindow({ startDate: '2026-10-20', endDate: '2026-10-22' })!;
    expect(w.begin).toBe(Date.UTC(2026, 9, 20));
    expect(w.end - w.begin).toBe(3 * DAY);
  });
  it('uses a single day when only one date is set', () => {
    expect(goalEventWindow({ endDate: '2026-10-22' })!.end - goalEventWindow({ endDate: '2026-10-22' })!.begin).toBe(DAY);
    expect(goalEventWindow({ startDate: '2026-10-22' })!.end - goalEventWindow({ startDate: '2026-10-22' })!.begin).toBe(DAY);
  });
  it('treats an end before the start as the start day', () => {
    const w = goalEventWindow({ startDate: '2026-10-22', endDate: '2026-10-20' })!;
    expect(w.end - w.begin).toBe(DAY);
  });
  it('has no window without a usable date', () => {
    expect(goalEventWindow({})).toBeNull();
    expect(goalEventWindow({ startDate: 'soon' })).toBeNull();
  });
});

describe('desiredGoalEvents', () => {
  it('lists only open dated items with nothing inside them, and skips undated, done and untitled ones', () => {
    const tree = [
      node('root', { startDate: '2026-10-01' }, [
        node('a', { endDate: '2026-10-05' }),
        node('b'),
        node('c', { endDate: '2026-10-06', completed: true }),
        node('d', { endDate: '2026-10-07', title: '   ' }),
        node('e', { startDate: '2026-10-08' }, [node('f', { endDate: '2026-10-09' })]),
      ]),
    ];
    // root and e hold other items, so only a and f (the lowest dated items) reach the calendar.
    expect(desiredGoalEvents(tree).map((e) => e.nodeId)).toEqual(['a', 'f']);
  });
});

describe('planGoalSync', () => {
  const want = desiredGoalEvents([node('a', { startDate: '2026-10-20', endDate: '2026-10-21' })])[0];
  const link = (over: Partial<GoalEventLink> = {}): GoalEventLink => ({
    eventId: '9', calendarId: '1', title: want.title, description: want.description, begin: want.begin, end: want.end, ...over,
  });

  it('creates events for new items', () => {
    expect(planGoalSync([want], {}, new Set()).create).toHaveLength(1);
  });
  it('does nothing when the event matches', () => {
    const p = planGoalSync([want], { a: link() }, new Set(['9']));
    expect(p).toEqual({ create: [], update: [], remove: [], tombstone: [] });
  });
  it('rewrites the event when the item changed', () => {
    const p = planGoalSync([{ ...want, title: 'New name' }], { a: link() }, new Set(['9']));
    expect(p.update).toHaveLength(1);
  });
  it('leaves a phone-side edit alone while the item is unchanged', () => {
    // The link records what YouDo wrote; the event on the phone may differ, and that is not checked.
    expect(planGoalSync([want], { a: link() }, new Set(['9'])).update).toHaveLength(0);
  });
  it('removes events for items that are done, deleted or undated', () => {
    expect(planGoalSync([], { a: link() }, new Set(['9'])).remove).toHaveLength(1);
  });
  it('remembers an event deleted on the phone and does not recreate it', () => {
    expect(planGoalSync([want], { a: link() }, new Set()).tombstone).toHaveLength(1);
    expect(planGoalSync([want], { a: link({ removed: true }) }, new Set()).create).toHaveLength(0);
  });
  it('brings a deleted event back only after the item changes', () => {
    expect(planGoalSync([{ ...want, end: want.end + DAY }], { a: link({ removed: true }) }, new Set()).create).toHaveLength(1);
  });
});
