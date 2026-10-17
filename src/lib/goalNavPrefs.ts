import { readStorageRaw } from './storageKeys';

/** When on (the default), the Goals tab reopens where you left it after you switch to another tab and back. */
export const GOAL_REMEMBER_POSITION_KEY = 'youdo-goal-remember-position-v1';

/** On unless switched off. Anything missing or unreadable counts as on. */
export function readGoalRememberPosition(): boolean {
  try {
    const raw = readStorageRaw(GOAL_REMEMBER_POSITION_KEY);
    return raw === null ? true : JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

/**
 * Trims a remembered path back to the deepest item that still exists
 * (an item may have been deleted while you were on another tab).
 */
export function trimToExistingPath(ids: string[], exists: (id: string) => boolean): string[] {
  let end = ids.length;
  while (end > 0 && !exists(ids[end - 1])) end -= 1;
  return ids.slice(0, end);
}
