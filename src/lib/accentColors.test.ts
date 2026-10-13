import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENT_COLORS, ACCENT_SWATCHES, DEFAULT_ACCENT, resolveAccent } from './accentColors';

describe('accent colours', () => {
  it('offers six calm accents with Sand as the default', () => {
    expect(ACCENT_COLORS).toEqual(['sand', 'sage', 'slate', 'plum', 'clay', 'graphite']);
    expect(DEFAULT_ACCENT).toBe('sand');
    expect(resolveAccent({})).toBe('sand');
  });

  it('moves the retired iOS colours to their closest calm accent', () => {
    expect(resolveAccent({ accent: 'blue' })).toBe('slate');
    expect(resolveAccent({ accent: 'purple' })).toBe('plum');
    expect(resolveAccent({ accent: 'pink' })).toBe('clay');
    expect(resolveAccent({ accent: 'orange' })).toBe('sand');
    expect(resolveAccent({ accent: 'green' })).toBe('sage');
    expect(resolveAccent({ accent: 'graphite' })).toBe('graphite');
    expect(resolveAccent({ accent: 'neon' })).toBe('sand');
  });

  it('never pairs an accent with a tick of the same colour', () => {
    for (const accent of ACCENT_COLORS) {
      const s = ACCENT_SWATCHES[accent];
      expect(s.tickDark.toLowerCase()).not.toBe(s.dark.toLowerCase());
      expect(s.tickLight.toLowerCase()).not.toBe(s.light.toLowerCase());
    }
  });

  it('keeps the stylesheet in sync with the palette', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    for (const accent of ACCENT_COLORS) {
      const s = ACCENT_SWATCHES[accent];
      expect(css).toContain(`html.dark[data-accent='${accent}'] { --primary: ${s.dark}; --accent-tick: ${s.tickDark}; }`);
      expect(css).toContain(`html.light-dusky[data-accent='${accent}'] { --primary: ${s.light}; --accent-tick: ${s.tickLight}; }`);
    }
  });
});
