import { readStorageRaw } from './storageKeys';

/**
 * Colors for calendar events: hex <-> hue/saturation/brightness for the color wheel, and the two
 * palettes of saved colors. Palettes live on this phone only, like the other look-and-feel choices.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** "#RRGGBB" in upper case, or null for anything else. */
export const normalizeHex = (value: unknown): string | null =>
  typeof value === 'string' && HEX.test(value.trim()) ? value.trim().toUpperCase() : null;

export const sameColor = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (normalizeHex(a) ?? '') === (normalizeHex(b) ?? '');

export interface Hsv {
  /** 0-360 */
  h: number;
  /** 0-1 */
  s: number;
  /** 0-1 */
  v: number;
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (hue < 1) rgb = [c, x, 0];
  else if (hue < 2) rgb = [x, c, 0];
  else if (hue < 3) rgb = [0, c, x];
  else if (hue < 4) rgb = [0, x, c];
  else if (hue < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`.toUpperCase();
}

export function hexToHsv(hex: string): Hsv {
  const clean = normalizeHex(hex);
  if (!clean) return { h: 0, s: 0, v: 1 };
  const r = parseInt(clean.slice(1, 3), 16) / 255;
  const g = parseInt(clean.slice(3, 5), 16) / 255;
  const b = parseInt(clean.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/* ─── The two saved palettes ──────────────────────────────────────────────── */

export const PALETTE_COUNT = 2;
export const PALETTE_SIZE = 6;
export const EVENT_PALETTES_KEY = 'youdo-event-palettes-v1';

/** A slot is a color, or null while it is empty. */
export type Palettes = Array<Array<string | null>>;

/** Starting colors, so the palettes are useful before anything is saved. Any slot can be overwritten. */
export const DEFAULT_PALETTES: Palettes = [
  ['#D50000', '#F4511E', '#F6BF26', '#33B679', '#039BE5', '#8E24AA'],
  ['#E67C73', '#0B8043', '#3F51B5', '#7986CB', '#616161', null],
];

/** Always PALETTE_COUNT rows of PALETTE_SIZE slots; bad entries become empty slots. */
export function normalizePalettes(value: unknown): Palettes {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: PALETTE_COUNT }, (_, p) => {
    const row = Array.isArray(rows[p]) ? (rows[p] as unknown[]) : [];
    return Array.from({ length: PALETTE_SIZE }, (_, i) => normalizeHex(row[i]));
  });
}

export function readPalettes(): Palettes {
  try {
    const raw = readStorageRaw(EVENT_PALETTES_KEY);
    return raw === null ? normalizePalettes(DEFAULT_PALETTES) : normalizePalettes(JSON.parse(raw));
  } catch {
    return normalizePalettes(DEFAULT_PALETTES);
  }
}

export function writePalettes(palettes: Palettes): void {
  try {
    localStorage.setItem(EVENT_PALETTES_KEY, JSON.stringify(normalizePalettes(palettes)));
  } catch {
    /* the palettes just won't be remembered */
  }
}

/** Palettes with one slot replaced. */
export function withPaletteColor(palettes: Palettes, palette: number, slot: number, color: string): Palettes {
  const hex = normalizeHex(color);
  return normalizePalettes(palettes).map((row, p) =>
    p === palette ? row.map((existing, i) => (i === slot ? hex : existing)) : row,
  );
}
