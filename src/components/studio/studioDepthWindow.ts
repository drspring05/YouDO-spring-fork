import type { GoalNode } from '../../types';

/**
 * Blueprint Studio shows at most this many indent levels at once. Opening a
 * deeper level slides the outer level off to the left (its rows and indent
 * are hidden) so titles keep their width; collapsing brings it back. Nothing
 * leaves the selection while it is out of view.
 */
export const STUDIO_VISIBLE_LEVELS = 3;

const isOpen = (node: GoalNode, expandedIds: ReadonlySet<string>) =>
  expandedIds.has(node.id) && Boolean(node.children?.length);

/** Depth of the deepest row on screen (0 = goals). */
export function deepestVisibleDepth(goals: GoalNode[], expandedIds: ReadonlySet<string>): number {
  let deepest = goals.length ? 0 : -1;
  const walk = (nodes: GoalNode[], depth: number) => {
    for (const node of nodes) {
      if (depth > deepest) deepest = depth;
      if (isOpen(node, expandedIds)) walk(node.children, depth + 1);
    }
  };
  walk(goals, 0);
  return deepest;
}

/** How many outer levels are slid out of view. */
export function depthWindowShift(goals: GoalNode[], expandedIds: ReadonlySet<string>, levels = STUDIO_VISIBLE_LEVELS): number {
  return Math.max(0, deepestVisibleDepth(goals, expandedIds) - (levels - 1));
}

/** Selected items whose level is slid out of view (they stay selected). */
export function selectedOutOfView(goals: GoalNode[], selectedIds: ReadonlySet<string>, shift: number): number {
  if (shift <= 0 || selectedIds.size === 0) return 0;
  let count = 0;
  const walk = (nodes: GoalNode[], depth: number) => {
    if (depth >= shift) return;
    for (const node of nodes) {
      if (selectedIds.has(node.id)) count += 1;
      if (node.children?.length) walk(node.children, depth + 1);
    }
  };
  walk(goals, 0);
  return count;
}

/** The open nodes whose children form the deepest level: collapsing them steps the view back one level. */
export function deepestOpenNodes(goals: GoalNode[], expandedIds: ReadonlySet<string>): string[] {
  const deepest = deepestVisibleDepth(goals, expandedIds);
  const ids: string[] = [];
  const walk = (nodes: GoalNode[], depth: number) => {
    for (const node of nodes) {
      if (!isOpen(node, expandedIds)) continue;
      if (depth === deepest - 1) ids.push(node.id);
      else walk(node.children, depth + 1);
    }
  };
  walk(goals, 0);
  return ids;
}
