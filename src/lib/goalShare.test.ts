import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GoalNode } from '../types';
import {
  GOAL_SHARE_MAX_DEPTH,
  GOAL_SHARE_MAX_ITEMS,
  buildGoalShare,
  goalShareCountLabel,
  goalShareMessage,
  goalShareStats,
  goalShareTooBig,
  markGoalShareSaved,
  materializeGoalShare,
  parseGoalShare,
  readSavedGoalShares,
} from './goalShare';

const node = (id: string, title: string, extra: Partial<GoalNode> = {}): GoalNode => ({
  id,
  kind: 'node',
  title,
  children: [],
  createdAt: 1,
  ...extra,
});

const sample = (): GoalNode =>
  node('g1', '  Learn   Spanish ', {
    kind: 'goal',
    description: 'Talk for five minutes',
    startDate: '2026-01-01',
    endDate: '2026-06-01',
    pinned: true,
    children: [
      node('a', 'Foundations', {
        children: [
          node('a1', 'Alphabet', { completed: true }),
          node('a2', 'Greetings', { steps: ['Hola', 'Adiós'], stepDone: [true, false], todayTaskId: 't1' }),
        ],
      }),
      node('b', 'Food words', { steps: ['20 words'], stepDone: [true], endDate: '2026-02-01' }),
    ],
  });

describe('buildGoalShare', () => {
  it('shares titles, descriptions, structure and steps without dates, ids or progress', () => {
    const share = buildGoalShare(sample(), false);
    expect(share).toEqual({
      v: 1,
      progress: false,
      goal: {
        title: 'Learn Spanish',
        description: 'Talk for five minutes',
        children: [
          {
            title: 'Foundations',
            children: [
              { title: 'Alphabet', children: [] },
              { title: 'Greetings', steps: ['Hola', 'Adiós'], children: [] },
            ],
          },
          { title: 'Food words', steps: ['20 words'], children: [] },
        ],
      },
    });
    expect(JSON.stringify(share)).not.toMatch(/2026|todayTaskId|pinned|"id"/);
  });

  it('adds the sender’s ticks only when progress is on', () => {
    const share = buildGoalShare(sample(), true);
    expect(share.progress).toBe(true);
    const [foundations, food] = share.goal.children;
    expect(foundations.children[0].done).toBe(true);
    expect(foundations.children[1].stepDone).toEqual([true, false]);
    expect(food).toMatchObject({ done: true, stepDone: [true] });
  });

  it('is plain JSON that reads back the same', () => {
    const share = buildGoalShare(sample(), true);
    expect(parseGoalShare(JSON.parse(JSON.stringify(share)))).toEqual(share);
  });
});

describe('parseGoalShare', () => {
  const valid = () => JSON.parse(JSON.stringify(buildGoalShare(sample(), false)));

  it('rejects anything that is not a version 1 share', () => {
    expect(parseGoalShare(null)).toBeNull();
    expect(parseGoalShare('text')).toBeNull();
    expect(parseGoalShare({ ...valid(), v: 2 })).toBeNull();
    expect(parseGoalShare({ ...valid(), progress: 'yes' })).toBeNull();
  });

  it('rejects bad items', () => {
    const bad = [
      (s: { goal: Record<string, unknown> }) => { s.goal.title = '   '; },
      (s: { goal: Record<string, unknown> }) => { s.goal.title = 'x'.repeat(201); },
      (s: { goal: Record<string, unknown> }) => { s.goal.children = 'nope'; },
      (s: { goal: Record<string, unknown> }) => { s.goal.description = 42; },
      (s: { goal: Record<string, unknown> }) => { s.goal.description = 'x'.repeat(4001); },
      (s: { goal: { children: Record<string, unknown>[] } }) => { s.goal.children[1].steps = ['ok', 7]; },
      (s: { goal: { children: Record<string, unknown>[] } }) => { s.goal.children[1].steps = Array(101).fill('step'); },
    ];
    for (const breakIt of bad) {
      const share = valid();
      breakIt(share);
      expect(parseGoalShare(share)).toBeNull();
    }
  });

  it('enforces the size and depth limits', () => {
    const wide = { v: 1, progress: false, goal: { title: 'Wide', children: Array.from({ length: GOAL_SHARE_MAX_ITEMS }, (_, i) => ({ title: `Item ${i}`, children: [] })) } };
    expect(parseGoalShare(wide)).toBeNull();

    let deep: Record<string, unknown> = { title: 'Leaf', children: [] };
    for (let i = 0; i < GOAL_SHARE_MAX_DEPTH; i++) deep = { title: `Level ${i}`, children: [deep] };
    expect(parseGoalShare({ v: 1, progress: false, goal: deep })).toBeNull();
  });

  it('keeps only known fields and drops progress when it was not shared', () => {
    const share = valid();
    share.goal.extra = '<script>';
    share.goal.children[1].done = true;
    share.goal.children[1].stepDone = [true];
    const parsed = parseGoalShare(share);
    expect(parsed?.goal).not.toHaveProperty('extra');
    expect(parsed?.goal.children[1]).not.toHaveProperty('done');
    expect(parsed?.goal.children[1]).not.toHaveProperty('stepDone');
  });
});

describe('goalShareStats', () => {
  it('counts items and steps, and progress only when shared', () => {
    expect(goalShareStats(buildGoalShare(sample(), false))).toEqual({ items: 4, steps: 3, pct: null });
    // Foundations: (100 + 50) / 2 = 75; Food words: 100 → (75 + 100) / 2
    expect(goalShareStats(buildGoalShare(sample(), true)).pct).toBe(88);
  });

  it('labels the counts', () => {
    expect(goalShareCountLabel({ items: 12, steps: 30 })).toBe('12 items · 30 steps');
    expect(goalShareCountLabel({ items: 1, steps: 0 })).toBe('1 item');
  });
});

describe('materializeGoalShare', () => {
  it('makes a fresh copy: new ids, nothing done, no dates', () => {
    const copy = materializeGoalShare(buildGoalShare(sample(), true), [], 1000);
    const all: GoalNode[] = [];
    const walk = (n: GoalNode) => { all.push(n); n.children.forEach(walk); };
    walk(copy);
    expect(copy.kind).toBe('goal');
    expect(all.every((n) => n.kind === 'goal' || n.kind === 'node')).toBe(true);
    expect(all.some((n) => ['g1', 'a', 'a1', 'a2', 'b'].includes(n.id))).toBe(false);
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
    expect(all.every((n) => !n.completed && !n.startDate && !n.endDate && !n.todayTaskId)).toBe(true);
    expect(all.flatMap((n) => n.stepDone ?? []).every((d) => d === false)).toBe(true);
  });

  it('renames on a name clash', () => {
    const share = buildGoalShare(sample(), false);
    expect(materializeGoalShare(share, [node('x', 'Something else')]).title).toBe('Learn Spanish');
    expect(materializeGoalShare(share, [node('x', 'learn spanish')]).title).toBe('Learn Spanish (2)');
    expect(materializeGoalShare(share, [node('x', 'Learn Spanish'), node('y', 'Learn Spanish (2)')]).title).toBe('Learn Spanish (3)');
  });
});

describe('message and limits', () => {
  it('writes a readable message line', () => {
    expect(goalShareMessage('  Run   a 5K ')).toBe('🎯 Shared a goal: Run a 5K');
  });

  it('flags a share that is too big to send', () => {
    expect(goalShareTooBig(buildGoalShare(sample(), true))).toBe(false);
    const huge = node('h', 'Huge', { kind: 'goal', children: Array.from({ length: 300 }, (_, i) => node(`n${i}`, `Item ${i}`, { description: 'x'.repeat(1000) })) });
    expect(goalShareTooBig(buildGoalShare(huge, false))).toBe(true);
  });
});

describe('saved shares', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('remembers saved message ids on this device', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(readSavedGoalShares().size).toBe(0);
    markGoalShareSaved('m1');
    expect(readSavedGoalShares().has('m1')).toBe(true);
  });

  it('works without storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readSavedGoalShares().size).toBe(0);
    expect(markGoalShareSaved('m1').has('m1')).toBe(true);
  });
});
