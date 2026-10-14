import { describe, expect, it } from 'vitest';
import type { GoalNode } from '../types';
import { nextOpenItem } from './goalTree';

const item = (id: string, extra: Partial<GoalNode> = {}): GoalNode =>
  ({ id, kind: 'task', title: id, children: [], createdAt: 1, ...extra }) as GoalNode;
const branch = (id: string, children: GoalNode[], extra: Partial<GoalNode> = {}): GoalNode =>
  ({ id, kind: 'node', title: id, children, createdAt: 1, ...extra }) as GoalNode;

describe('nextOpenItem', () => {
  it('names the first unfinished direct child, not a grandchild', () => {
    const tree = branch('phase', [
      branch('maths', [
        item('l1', { steps: ['a', 'b'], stepDone: [true, true] }),
        item('l2', { steps: ['a', 'b'], stepDone: [true, false] }),
      ]),
      item('revision'),
    ]);
    expect(nextOpenItem(tree)?.id).toBe('maths');
  });

  it('skips items marked done and branches marked complete', () => {
    const tree = branch('phase', [
      branch('done-branch', [item('x')], { completed: true }),
      item('marked', { completed: true }),
      item('open'),
    ]);
    expect(nextOpenItem(tree)?.id).toBe('open');
  });

  it('skips a branch whose items are all done even if it is not marked complete', () => {
    const tree = branch('phase', [branch('done', [item('a', { completed: true })]), branch('open', [item('b')])]);
    expect(nextOpenItem(tree)?.id).toBe('open');
  });

  it('returns null when everything is finished', () => {
    const tree = branch('phase', [item('a', { completed: true }), item('b', { steps: ['s'], stepDone: [true] })]);
    expect(nextOpenItem(tree)).toBeNull();
  });
});
