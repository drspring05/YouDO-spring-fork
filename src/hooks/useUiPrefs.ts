import { useLayoutEffect, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '../lib/storageKeys';
import { reducedEffectsSnapshot } from './useReducedEffects';

/**
 * Look-and-feel switches from Settings → Appearance:
 *
 * - `legacyStyle` brings back the v7 interface (its stylesheet, header, nav
 *   bar and task cards) in place of the Apple-style redesign.
 * - `roomyHeader` brings back the first v8 header (date above the title, the
 *   ring beside the icon, the quote as a card) in place of the compact one.
 * - `liquidGlass` is the liquid selection pill that travels between tabs and
 *   the swell-and-spring response on icon buttons, together.
 *
 * Kept in localStorage per device, like Reduced Effects, and mirrored onto
 * `<html>` as data attributes so CSS can follow them.
 */
export interface UiPrefs {
  legacyStyle: boolean;
  liquidGlass: boolean;
  roomyHeader: boolean;
}

type PrefKey = keyof UiPrefs;

const DEFAULTS: UiPrefs = { legacyStyle: false, liquidGlass: true, roomyHeader: false };
const EVENT = 'youdo-ui-prefs-change';
const memory: Partial<UiPrefs> = {};

function read(key: PrefKey): boolean {
  if (memory[key] !== undefined) return memory[key]!;
  try {
    const value = localStorage.getItem(STORAGE_KEYS[key]);
    if (value === 'true' || value === 'false') return value === 'true';
  } catch { /* Restricted storage: fall back to the default. */ }
  return DEFAULTS[key];
}

let cached: UiPrefs | null = null;
export function uiPrefsSnapshot(): UiPrefs {
  const next: UiPrefs = { legacyStyle: read('legacyStyle'), liquidGlass: read('liquidGlass'), roomyHeader: read('roomyHeader') };
  if (
    cached &&
    cached.legacyStyle === next.legacyStyle &&
    cached.liquidGlass === next.liquidGlass &&
    cached.roomyHeader === next.roomyHeader
  ) {
    return cached;
  }
  cached = next;
  return next;
}

export function setUiPref(key: PrefKey, enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEYS[key], String(enabled));
    delete memory[key];
  } catch {
    memory[key] = enabled;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeUiPrefs(notify: () => void) {
  window.addEventListener(EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

export function useUiPrefs() {
  const prefs = useSyncExternalStore(subscribeUiPrefs, uiPrefsSnapshot, () => DEFAULTS);
  useLayoutEffect(() => {
    const root = document.documentElement.dataset;
    root.uiStyle = prefs.legacyStyle ? 'legacy' : 'modern';
    root.liquidGlass = String(prefs.liquidGlass);
  }, [prefs]);
  return [prefs, setUiPref] as const;
}

/** Whether physics-driven motion should run right now (Reduced Effects off). */
export function motionAllowed(): boolean {
  return !reducedEffectsSnapshot();
}
