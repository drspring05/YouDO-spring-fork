import { describe, expect, it } from 'vitest';
import type { GoalNode } from '../../types';
import { deepestOpenNodes, deepestVisibleDepth, depthWindowShift, selectedOutOfView } from './studioDepthWindow';

const node = (id: string, children: GoalNode[] = []): GoalNode =>
  ({ id, kind: children.length || id === 'goal' ? 'goal' : 'task', title: id, children, completed: false, createdAt: 1 }) as GoalNode;

// goal > phase1 > maths > lectures > chapter1 > lecture1, plus a closed phase2.
const tree = [
  node('goal', [
    node('phase1', [node('maths', [node('lectures', [node('chapter1', [node('lecture1')])])])]),
    node('phase2', [node('physics')]),
  ]),
];

describe('Blueprint Studio three-level window', () => {
  it('shows everything while three or fewer levels are open', () => {
    const open = new Set(['goal', 'phase1']);
    expect(deepestVisibleDepth(tree, open)).toBe(2);
    expect(depthWindowShift(tree, open)).toBe(0);
  });

  it('slides one outer level away when a fourth level opens, and back when it closes', () => {
    const fourth = new Set(['goal', 'phase1', 'maths']);
    expect(deepestVisibleDepth(tree, fourth)).toBe(3);
    expect(depthWindowShift(tree, fourth)).toBe(1);
    expect(deepestOpenNodes(tree, fourth)).toEqual(['maths']);

    fourth.delete('maths');
    expect(depthWindowShift(tree, fourth)).toBe(0);
  });

  it('keeps sliding as the path goes deeper', () => {
    const deep = new Set(['goal', 'phase1', 'maths', 'lectures', 'chapter1']);
    expect(deepestVisibleDepth(tree, deep)).toBe(5);
    expect(depthWindowShift(tree, deep)).toBe(3);
    expect(deepestOpenNodes(tree, deep)).toEqual(['chapter1']);
  });

  it('ignores open nodes without children and closed branches', () => {
    const open = new Set(['goal', 'phase2', 'physics', 'lecture1']);
    expect(deepestVisibleDepth(tree, open)).toBe(2);
    expect(depthWindowShift(tree, open)).toBe(0);
  });

  it('counts selected items in levels that slid out of view', () => {
    const open = new Set(['goal', 'phase1', 'maths', 'lectures']);
    const shift = depthWindowShift(tree, open);
    expect(shift).toBe(2);
    // goal (level 0) and phase2 (level 1) are out of view; maths (level 2) is on screen.
    expect(selectedOutOfView(tree, new Set(['goal', 'phase2', 'maths']), shift)).toBe(2);
    expect(selectedOutOfView(tree, new Set(['maths']), shift)).toBe(0);
    expect(selectedOutOfView(tree, new Set(['goal']), 0)).toBe(0);
  });

  it('handles an empty studio', () => {
    expect(deepestVisibleDepth([], new Set())).toBe(-1);
    expect(depthWindowShift([], new Set())).toBe(0);
    expect(deepestOpenNodes([], new Set())).toEqual([]);
  });
});
