import type { GoalNode } from '../types';
import { uid } from './ids';
import { STORAGE_KEYS } from './storageKeys';
import { recomputeCompleted, rollupPct } from './goalTree';

/**
 * A goal tree shared in a DM. Titles, descriptions, structure and steps only:
 * no dates, ids, pins or Today links. Progress travels only when the sender
 * turns on "Show my progress", and a saved copy always starts fresh.
 */
export interface SharedGoalNode {
  title: string;
  description?: string;
  steps?: string[];
  children: SharedGoalNode[];
  /** Sender's progress, present only when the share includes it. */
  done?: boolean;
  stepDone?: boolean[];
}

export interface GoalShare {
  v: 1;
  progress: boolean;
  goal: SharedGoalNode;
}

export const GOAL_SHARE_MAX_ITEMS = 1000;
export const GOAL_SHARE_MAX_DEPTH = 20;
export const GOAL_SHARE_MAX_STEPS = 100;
export const GOAL_SHARE_MAX_TITLE = 200;
export const GOAL_SHARE_MAX_DESCRIPTION = 4000;
/** Kept under the server's size check on direct_messages.goal_share. */
export const GOAL_SHARE_MAX_BYTES = 200 * 1024;

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');

/** The readable line stored as the message text (push, inbox preview, older apps). */
export function goalShareMessage(title: string): string {
  return `🎯 Shared a goal: ${clean(title)}`;
}

export function buildGoalShare(root: GoalNode, withProgress: boolean): GoalShare {
  const build = (node: GoalNode): SharedGoalNode => {
    const children = node.children.map(build);
    const steps = children.length === 0 && node.steps && node.steps.length > 0 ? node.steps.map(clean) : undefined;
    const description = node.description?.trim();
    return {
      title: clean(node.title),
      ...(description ? { description } : {}),
      ...(steps ? { steps } : {}),
      children,
      ...(withProgress
        ? {
            done: Boolean(node.completed),
            ...(steps ? { stepDone: steps.map((_, i) => Boolean(node.stepDone?.[i])) } : {}),
          }
        : {}),
    };
  };
  return { v: 1, progress: withProgress, goal: build(recomputeCompleted(root)) };
}

/** Too big to send (counted the way it is stored). */
export function goalShareTooBig(share: GoalShare): boolean {
  return new Blob([JSON.stringify(share)]).size > GOAL_SHARE_MAX_BYTES;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Strict reader for a share that arrived from someone else. Null when anything is off. */
export function parseGoalShare(value: unknown): GoalShare | null {
  if (!isRecord(value) || value.v !== 1 || typeof value.progress !== 'boolean') return null;
  const progress = value.progress;
  let count = 0;

  const read = (raw: unknown, depth: number): SharedGoalNode | null => {
    if (!isRecord(raw) || depth > GOAL_SHARE_MAX_DEPTH) return null;
    if (++count > GOAL_SHARE_MAX_ITEMS) return null;
    if (typeof raw.title !== 'string') return null;
    const title = clean(raw.title);
    if (!title || title.length > GOAL_SHARE_MAX_TITLE) return null;

    let description: string | undefined;
    if (raw.description !== undefined) {
      if (typeof raw.description !== 'string' || raw.description.length > GOAL_SHARE_MAX_DESCRIPTION) return null;
      description = raw.description.trim() || undefined;
    }

    if (!Array.isArray(raw.children)) return null;
    const children: SharedGoalNode[] = [];
    for (const child of raw.children) {
      const node = read(child, depth + 1);
      if (!node) return null;
      children.push(node);
    }

    let steps: string[] | undefined;
    if (raw.steps !== undefined) {
      if (!Array.isArray(raw.steps) || raw.steps.length > GOAL_SHARE_MAX_STEPS) return null;
      if (raw.steps.some((step) => typeof step !== 'string' || !clean(step) || step.length > GOAL_SHARE_MAX_TITLE)) return null;
      steps = (raw.steps as string[]).map(clean);
      if (steps.length === 0 || children.length > 0) steps = undefined;
    }

    let done: boolean | undefined;
    let stepDone: boolean[] | undefined;
    if (progress) {
      done = raw.done === true;
      if (steps) {
        const marks = Array.isArray(raw.stepDone) ? raw.stepDone : [];
        stepDone = steps.map((_, i) => marks[i] === true);
      }
    }

    return {
      title,
      ...(description ? { description } : {}),
      ...(steps ? { steps } : {}),
      children,
      ...(done !== undefined ? { done } : {}),
      ...(stepDone ? { stepDone } : {}),
    };
  };

  const goal = read(value.goal, 1);
  return goal ? { v: 1, progress, goal } : null;
}

/**
 * The share as a goal tree with fresh ids. With progress it mirrors the
 * sender's ticks (for viewing); without, every item starts open.
 */
export function goalShareTree(share: GoalShare, withProgress: boolean, now = Date.now()): GoalNode {
  let offset = 0;
  const build = (node: SharedGoalNode, root: boolean): GoalNode => {
    const children = node.children.map((child) => build(child, false));
    const steps = node.steps ? [...node.steps] : undefined;
    return {
      id: uid('goal'),
      kind: root ? 'goal' : 'node',
      title: node.title,
      ...(node.description ? { description: node.description } : {}),
      children,
      ...(steps
        ? { steps, stepDone: steps.map((_, i) => (withProgress ? Boolean(node.stepDone?.[i]) : false)) }
        : {}),
      completed: withProgress ? Boolean(node.done) : false,
      todayTaskId: null,
      pinned: false,
      createdAt: now + offset++,
    };
  };
  return recomputeCompleted(build(share.goal, true));
}

export interface GoalShareStats {
  items: number;
  steps: number;
  /** Sender's progress, only when they shared it. */
  pct: number | null;
}

export function goalShareStats(share: GoalShare): GoalShareStats {
  let items = 0;
  let steps = 0;
  const walk = (node: SharedGoalNode) => {
    steps += node.steps?.length ?? 0;
    for (const child of node.children) {
      items += 1;
      walk(child);
    }
  };
  walk(share.goal);
  return { items, steps, pct: share.progress ? rollupPct(goalShareTree(share, true)) : null };
}

/** "12 items · 30 steps" */
export function goalShareCountLabel(stats: Pick<GoalShareStats, 'items' | 'steps'>): string {
  const parts = [`${stats.items} ${stats.items === 1 ? 'item' : 'items'}`];
  if (stats.steps > 0) parts.push(`${stats.steps} ${stats.steps === 1 ? 'step' : 'steps'}`);
  return parts.join(' · ');
}

/** A fresh copy for the receiver's Goals, renamed "Title (2)" when the name is taken. */
export function materializeGoalShare(share: GoalShare, existing: GoalNode[], now = Date.now()): GoalNode {
  const tree = goalShareTree(share, false, now);
  const taken = new Set(existing.map((goal) => clean(goal.title).toLocaleLowerCase()));
  let title = tree.title;
  for (let n = 2; taken.has(title.toLocaleLowerCase()); n++) title = `${tree.title} (${n})`;
  return { ...tree, title };
}

/* Which shared goals this device already saved, so the card can say "Saved". */
const SAVED_LIMIT = 200;

export function readSavedGoalShares(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.goalShareSaved) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markGoalShareSaved(messageId: string): Set<string> {
  const ids = [...readSavedGoalShares().add(messageId)].slice(-SAVED_LIMIT);
  try {
    localStorage.setItem(STORAGE_KEYS.goalShareSaved, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  return new Set(ids);
}
