import { useSyncExternalStore } from 'react';

/**
 * The adjustable side of Liquid Glass — the tab pill's refraction and tint —
 * set from the sliders under its switch in Settings → Appearance.
 *
 * Stored per device. The pill reads [liquidTuning] on every frame, so a
 * slider takes effect on the next tap, including in the preview.
 */
export interface LiquidTuning {
  /** How far the glass bends what is under it, in px. */
  glassBend: number;
  /** White wash over the glass, 0–1. */
  glassTint: number;
}

export const DEFAULT_TUNING: LiquidTuning = {
  glassBend: 14,
  glassTint: 0.07,
};

const KEY = 'youdo-liquid-tuning-v1';
const EVENT = 'youdo-liquid-tuning-change';

function load(): LiquidTuning {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LiquidTuning>;
      const merged = { ...DEFAULT_TUNING };
      for (const key of Object.keys(DEFAULT_TUNING) as (keyof LiquidTuning)[]) {
        const value = parsed[key];
        if (typeof value === 'number' && Number.isFinite(value)) merged[key] = value;
      }
      return merged;
    }
  } catch { /* Restricted or corrupt storage: defaults. */ }
  return { ...DEFAULT_TUNING };
}

let current: LiquidTuning | null = null;

export function liquidTuning(): LiquidTuning {
  if (!current) current = load();
  return current;
}

export function setLiquidTuning(patch: Partial<LiquidTuning> | 'reset') {
  current = patch === 'reset' ? { ...DEFAULT_TUNING } : { ...liquidTuning(), ...patch };
  try {
    if (patch === 'reset') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(current));
  } catch { /* Keeps working for this session. */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      current = null;
      notify();
    }
  };
  window.addEventListener(EVENT, notify);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLiquidTuning() {
  return useSyncExternalStore(subscribe, liquidTuning, () => DEFAULT_TUNING);
}
