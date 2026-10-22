import { readStorageRaw } from './storageKeys';

/**
 * "Spring Fork" master switch (Settings → Preferences). On means the fork's calendar, planning and goal changes.
 * Off means the app runs the original upstream screens and every calendar sync stays idle. Data in storage
 * is never touched by the switch.
 *
 * The value is read ONCE when the app starts, so a change in Settings applies after the app is restarted.
 * Missing or unreadable counts as on.
 */
export const SPRING_FORK_KEY = 'youdo-spring-fork-v1';

export function readSpringForkStored(): boolean {
  try {
    const raw = readStorageRaw(SPRING_FORK_KEY);
    return raw === null ? true : JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

/** What this app run is using. Fixed until the app restarts. */
export const SPRING_FORK_ON: boolean = readSpringForkStored();
