import { afterEach, describe, expect, it, vi } from 'vitest';
import { GOAL_REMEMBER_POSITION_KEY, readGoalRememberPosition, trimToExistingPath } from './goalNavPrefs';

const stubStorage = (initial: Record<string, string> = {}) => {
  const saved = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
};

describe('remember Goals position', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is on when nothing is saved', () => {
    stubStorage();
    expect(readGoalRememberPosition()).toBe(true);
  });

  it('is off only when saved as false', () => {
    stubStorage({ [GOAL_REMEMBER_POSITION_KEY]: JSON.stringify(false) });
    expect(readGoalRememberPosition()).toBe(false);
    stubStorage({ [GOAL_REMEMBER_POSITION_KEY]: 'not json' });
    expect(readGoalRememberPosition()).toBe(true);
  });
});

describe('trimToExistingPath', () => {
  const live = new Set(['a', 'b', 'c']);
  const exists = (id: string) => live.has(id);

  it('keeps a path whose items all exist', () => {
    expect(trimToExistingPath(['a', 'b', 'c'], exists)).toEqual(['a', 'b', 'c']);
  });

  it('cuts back to the deepest item that still exists', () => {
    expect(trimToExistingPath(['a', 'b', 'gone'], exists)).toEqual(['a', 'b']);
    expect(trimToExistingPath(['gone', 'x'], exists)).toEqual([]);
  });

  it('handles an empty path', () => {
    expect(trimToExistingPath([], exists)).toEqual([]);
  });
});
