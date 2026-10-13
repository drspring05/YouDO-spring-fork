import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../lib/storageKeys';
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

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(STORAGE_KEYS.theme, DEFAULT_THEME);
  const accent = resolveAccent(theme);

  useEffect(() => {
    if (theme.darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light-dusky');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-dusky');
    }
  }, [theme.darkMode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  return [theme, setTheme] as const;
}
