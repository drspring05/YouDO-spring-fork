import { daysBetweenLocalISO } from './dates';
import type { GoalNode, Task } from '../types';

/**
 * Small pure helpers behind the planned-work cards (calendar day leaflet, Today's Upcoming list),
 * finished-task calendar cleanup and goal totals.
 */

/** The task's last day (inclusive). A task without a timeframe ends on its first day. */
export function taskLastDay(task: { targetDate?: string | null; endDate?: string }): string | null {
  if (!task.targetDate) return null;
  return task.endDate && task.endDate > task.targetDate ? task.endDate : task.targetDate;
}

const isDone = (task: Pick<Task, 'steps' | 'progress'>) =>
  task.progress >= (task.steps.length > 0 ? task.steps.length : 1);

/**
 * A finished task comes off the phone calendar. Old finished tasks (whose last day is already past) are left
 * alone so the calendar keeps its history; a task that was finished late (a backlog catch-up) still comes off.
 */
export function shouldReleaseOnFinish(
  task: Pick<Task, 'steps' | 'progress' | 'calendarEventId'> &
    Partial<Pick<Task, 'targetDate' | 'endDate' | 'originalTargetDate'>>,
  today: string,
): boolean {
  if (!task.calendarEventId || !isDone(task)) return false;
  const last = taskLastDay(task);
  if (!last) return true;
  return last >= today || Boolean(task.originalTargetDate);
}

/** A task whose event was taken off because it was finished, and which is open again, gets its event back. */
export function shouldRelinkAfterUnfinish(
  task: Pick<Task, 'steps' | 'progress'> & Partial<Pick<Task, 'targetDate' | 'calendarEventId' | 'calendarFinished'>>,
): boolean {
  return Boolean(task.calendarFinished) && !task.calendarEventId && Boolean(task.targetDate) && !isDone(task);
}

/**
 * The chip that says where a task lives in the goal tree: the goal's name plus the last two branches
 * before the task. `ancestors` is the path from the goal down to (not including) the task itself.
 */
export function originChipNames(ancestors: string[]): string[] {
  const names = ancestors.map((name) => name.trim()).filter(Boolean);
  if (names.length <= 3) return names;
  return [names[0], ...names.slice(-2)];
}

/**
 * Total days allotted from start to end, counted the way "days left" is: the days between the two dates
 * (2 Sep to 1 Jul is 302). A one-day range counts as 1. Null when either date is missing or the range is backwards.
 */
export function daysAllotted(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const days = daysBetweenLocalISO(start, end);
  return days < 0 ? null : Math.max(1, days);
}

export interface UpcomingGroup {
  date: string;
  tasks: Task[];
}

/**
 * Open tasks whose first day is after today, earliest first, grouped by day. A task that starts today or earlier
 * belongs to Today or Backlog, so it is left out here.
 */
export function upcomingTaskGroups(tasks: Task[], today: string): UpcomingGroup[] {
  const byDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.targetDate || task.targetDate <= today || isDone(task)) continue;
    const list = byDate.get(task.targetDate) ?? [];
    list.push(task);
    byDate.set(task.targetDate, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, list]) => ({ date, tasks: [...list].sort((a, b) => a.order - b.order) }));
}

export interface GoalSearchHit {
  node: GoalNode;
  /** titles from the goal down to the node's parent (empty for a goal itself) */
  ancestors: GoalNode[];
  /** ids from the goal down to the node, ready for the Goals tab's path */
  pathIds: string[];
  role: 'Goal' | 'Branch' | 'Task';
}

/**
 * Every goal, branch and task whose title (or description) holds the words typed, best matches first:
 * a title that starts with the text, then a title that contains it, then a description match.
 */
export function searchGoals(goals: GoalNode[], query: string, limit = 40): GoalSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const words = needle.split(/\s+/);
  const scored: { hit: GoalSearchHit; score: number; order: number }[] = [];
  let order = 0;
  const visit = (node: GoalNode, ancestors: GoalNode[]) => {
    const title = (node.title ?? '').toLowerCase();
    const body = `${node.description ?? ''} ${(node.steps ?? []).join(' ')}`.toLowerCase();
    const inTitle = words.every((word) => title.includes(word));
    const inBody = !inTitle && words.every((word) => title.includes(word) || body.includes(word));
    if (inTitle || inBody) {
      const score = title.startsWith(needle) ? 0 : inTitle ? 1 : 2;
      const role: GoalSearchHit['role'] =
        ancestors.length === 0 ? 'Goal' : node.children.length > 0 ? 'Branch' : 'Task';
      scored.push({
        hit: { node, ancestors, pathIds: [...ancestors.map((a) => a.id), node.id], role },
        score,
        order: order++,
      });
    }
    node.children.forEach((child) => visit(child, [...ancestors, node]));
  };
  goals.forEach((goal) => visit(goal, []));
  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map((item) => item.hit);
}
