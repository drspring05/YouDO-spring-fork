import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { readStorageRaw, STORAGE_KEYS } from '../lib/storageKeys';
import { DEFAULT_ACCENT, resolveAccent, type AccentColor } from '../lib/accentColors';

export interface Theme {
  darkMode: boolean;
  /** Optional so themes stored before v8 keep loading unchanged. */
  accent?: AccentColor;
}

export const DEFAULT_THEME: Theme = {
  darkMode: true,
  accent: DEFAULT_ACCENT,
};

function applyMode(darkMode: boolean) {
  document.documentElement.classList.toggle('dark', darkMode);
  document.documentElement.classList.toggle('light-dusky', !darkMode);
}

/** Puts the saved mode and accent on the page before it first paints, so the
 *  start screen already wears them. */
export function applyStoredTheme(): void {
  let theme: Theme = DEFAULT_THEME;
  try {
    const raw = readStorageRaw(STORAGE_KEYS.theme);
    if (raw) theme = (JSON.parse(raw) as Theme | null) ?? DEFAULT_THEME;
  } catch {
    /* keep the default look */
  }
  applyMode(Boolean(theme.darkMode));
  document.documentElement.dataset.accent = resolveAccent(theme);
}

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(STORAGE_KEYS.theme, DEFAULT_THEME);
  const accent = resolveAccent(theme);

  useEffect(() => {
    applyMode(Boolean(theme.darkMode));
  }, [theme.darkMode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  return [theme, setTheme] as const;
}
