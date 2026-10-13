/** Apple system tint colors offered as the app-wide accent. */
export const ACCENT_COLORS = ['blue', 'indigo', 'purple', 'pink', 'orange', 'green', 'teal', 'graphite'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export const ACCENT_SWATCHES: Record<AccentColor, { label: string; dark: string; light: string }> = {
  blue: { label: 'Blue', dark: '#0A84FF', light: '#007AFF' },
  indigo: { label: 'Indigo', dark: '#5E5CE6', light: '#5856D6' },
  purple: { label: 'Purple', dark: '#BF5AF2', light: '#AF52DE' },
  pink: { label: 'Pink', dark: '#FF375F', light: '#FF2D55' },
  orange: { label: 'Orange', dark: '#FF9F0A', light: '#FF9500' },
  green: { label: 'Green', dark: '#30D158', light: '#34C759' },
  teal: { label: 'Teal', dark: '#40C8E0', light: '#30B0C7' },
  graphite: { label: 'Graphite', dark: '#98989D', light: '#8E8E93' },
};

export const DEFAULT_ACCENT: AccentColor = 'blue';

export function resolveAccent(theme: { accent?: string }): AccentColor {
  return theme.accent && (ACCENT_COLORS as readonly string[]).includes(theme.accent) ? (theme.accent as AccentColor) : DEFAULT_ACCENT;
}
