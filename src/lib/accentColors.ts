/**
 * The app-wide accent: six calm colours, each designed as a pair with the
 * colour of the tick in the YouDO mark, so the in-app icon always looks
 * finished. Dark mode uses the soft tones on near-black; light mode uses
 * deeper tones so white text on a filled button stays readable.
 */
export const ACCENT_COLORS = ['sand', 'sage', 'slate', 'plum', 'clay', 'graphite'] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

interface AccentPair {
  label: string;
  /** The accent itself (buttons, links, rings) and the Y of the mark. */
  dark: string;
  light: string;
  /** The tick of the mark that sits with this accent. */
  tickDark: string;
  tickLight: string;
}

const SAGE_TICK = { tickDark: '#8FB394', tickLight: '#4E7A57' };
const SAND_TICK = { tickDark: '#D6B784', tickLight: '#8C6A3A' };

export const ACCENT_SWATCHES: Record<AccentColor, AccentPair> = {
  sand: { label: 'Sand', dark: '#C9A46E', light: '#8C6A3A', ...SAGE_TICK },
  sage: { label: 'Sage', dark: '#8FB394', light: '#4E7A57', ...SAND_TICK },
  slate: { label: 'Slate', dark: '#8DA6C9', light: '#4A6A93', ...SAND_TICK },
  plum: { label: 'Plum', dark: '#B39AC8', light: '#7A5A8C', ...SAGE_TICK },
  clay: { label: 'Clay', dark: '#CC8E6E', light: '#A55A3A', ...SAGE_TICK },
  graphite: { label: 'Graphite', dark: '#A4A6AB', light: '#5E6066', ...SAND_TICK },
};

export const DEFAULT_ACCENT: AccentColor = 'sand';

/** The v8 preview's iOS colours, moved to their closest calm accent. */
const RETIRED_ACCENTS: Record<string, AccentColor> = {
  blue: 'slate',
  indigo: 'slate',
  teal: 'slate',
  purple: 'plum',
  pink: 'clay',
  orange: 'sand',
  green: 'sage',
};

export function resolveAccent(theme: { accent?: string }): AccentColor {
  const accent = theme.accent;
  if (accent && (ACCENT_COLORS as readonly string[]).includes(accent)) return accent as AccentColor;
  if (accent && accent in RETIRED_ACCENTS) return RETIRED_ACCENTS[accent];
  return DEFAULT_ACCENT;
}
