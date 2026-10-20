import { STORAGE_KEYS } from './storageKeys';

/** The ambient timer as two-digit minutes and seconds: 00:00, 09:58, 1:39:58. */
export function formatAmbientTimer(totalSeconds: number): string {
  const { hours, minutes, seconds } = ambientDigits(totalSeconds);
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * What the ambient clock shows: minutes and seconds big, always two digits,
 * and the hours apart and small (0 when under an hour).
 */
export function ambientDigits(totalSeconds: number): { hours: number; minutes: string; seconds: string } {
  const s = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(s / 3600),
    minutes: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    seconds: String(s % 60).padStart(2, '0'),
  };
}

/** Largest drift from centre, in px: enough to spare pixels, too little to notice. */
export const DRIFT_RANGE = 8;

/**
 * Where the face sits after `step` minutes: a slow, repeating walk around the
 * centre, so no digit edge stays lit on the same pixels (OLED burn-in).
 */
export function ambientDrift(step: number): { x: number; y: number } {
  const angle = step * 2.399963; // golden angle: points spread evenly, never repeat quickly
  const radius = DRIFT_RANGE * Math.sqrt(((step % 12) + 1) / 12);
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
}

/** Settings → Focus and streak: open the ambient clock when the phone turns sideways during a session. */
export function ambientAutoOpenEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.ambientAutoOpen) !== 'false';
  } catch {
    return true;
  }
}

export function setAmbientAutoOpen(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ambientAutoOpen, String(enabled));
  } catch {
    /* Restricted storage: the default (on) stays. */
  }
}

/** A phone turned sideways: landscape and short, on a touch screen (not a laptop window). */
export const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 520px) and (pointer: coarse)';

export function ambientTipSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.ambientTipSeen) === 'true';
  } catch {
    return true;
  }
}

export function markAmbientTipSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ambientTipSeen, 'true');
  } catch {
    /* ignore */
  }
}
