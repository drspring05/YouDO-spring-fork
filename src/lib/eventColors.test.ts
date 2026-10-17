import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTES,
  PALETTE_COUNT,
  PALETTE_SIZE,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  normalizePalettes,
  sameColor,
  withPaletteColor,
} from './eventColors';

describe('normalizeHex', () => {
  it('accepts #RRGGBB in either case and returns it in upper case', () => {
    expect(normalizeHex('#aabbcc')).toBe('#AABBCC');
    expect(normalizeHex(' #AABBCC ')).toBe('#AABBCC');
  });
  it('rejects everything else', () => {
    expect(normalizeHex('aabbcc')).toBeNull();
    expect(normalizeHex('#abc')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(12)).toBeNull();
  });
});

describe('sameColor', () => {
  it('ignores letter case and treats missing colors as equal', () => {
    expect(sameColor('#aabbcc', '#AABBCC')).toBe(true);
    expect(sameColor('#aabbcc', '#AABBCD')).toBe(false);
    expect(sameColor(null, undefined)).toBe(true);
    expect(sameColor('#AABBCC', null)).toBe(false);
  });
});

describe('hsv conversion', () => {
  it('converts the primary colors', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#FF0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000FF');
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe('#FFFFFF');
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe('#000000');
  });
  it('wraps the hue around', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#FF0000');
    expect(hsvToHex({ h: -120, s: 1, v: 1 })).toBe('#0000FF');
  });
  it('round-trips colors', () => {
    for (const hex of ['#FF0000', '#336699', '#F4511E', '#0B8043', '#8E24AA', '#616161']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
  it('reads a bad color as white', () => {
    expect(hexToHsv('nope')).toEqual({ h: 0, s: 0, v: 1 });
  });
});

describe('palettes', () => {
  it('always has two rows of six slots, with bad entries as empty slots', () => {
    expect(normalizePalettes(null)).toHaveLength(PALETTE_COUNT);
    const fixed = normalizePalettes([['#aabbcc', 'nope'], 'x']);
    expect(fixed.every((row) => row.length === PALETTE_SIZE)).toBe(true);
    expect(fixed[0][0]).toBe('#AABBCC');
    expect(fixed[0][1]).toBeNull();
    expect(fixed[1].every((slot) => slot === null)).toBe(true);
  });

  it('ships starting colors', () => {
    expect(normalizePalettes(DEFAULT_PALETTES)[0][0]).toBe('#D50000');
  });

  it('replaces one slot and leaves the rest', () => {
    const next = withPaletteColor(DEFAULT_PALETTES, 1, 5, '#123456');
    expect(next[1][5]).toBe('#123456');
    expect(next[1][0]).toBe(DEFAULT_PALETTES[1][0]);
    expect(next[0]).toEqual(normalizePalettes(DEFAULT_PALETTES)[0]);
  });
});
