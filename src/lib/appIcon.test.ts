import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_ICONS, DEFAULT_APP_ICON, isAppIcon } from './appIcon';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('app icons', () => {
  it('offers five icons with Signature as the default', () => {
    expect(APP_ICONS.map((icon) => icon.id)).toEqual(['signature', 'ivory', 'sand', 'onyx', 'linen']);
    expect(DEFAULT_APP_ICON).toBe('signature');
    expect(isAppIcon('linen')).toBe(true);
    expect(isAppIcon('blue')).toBe(false);
    expect(isAppIcon(null)).toBe(false);
  });

  it('keeps the Android plugin in sync with the icon list', () => {
    const java = read('android/app/src/main/java/com/mattedhairr/youdo/YouDoAppIconPlugin.java');
    const ids = APP_ICONS.map((icon) => `"${icon.id}"`).join(', ');
    const aliases = APP_ICONS.map((icon) => `"${icon.alias}"`).join(', ');
    expect(java).toContain(`IDS = { ${ids} }`);
    expect(java).toContain(`ALIASES = { ${aliases} }`);
  });

  it('declares one launcher entry per icon, only the default enabled, keeping .MainActivity', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    for (const icon of APP_ICONS) {
      const block = manifest.split('<activity-alias').find((part) => part.includes(`android:name=".${icon.alias}"`));
      expect(block, icon.alias).toBeDefined();
      expect(block).toContain('android:targetActivity=".YouDoActivity"');
      expect(block).toContain(`android:enabled="${icon.id === DEFAULT_APP_ICON}"`);
      expect(block).toContain('android.intent.category.LAUNCHER');
    }
    expect(APP_ICONS.find((icon) => icon.id === DEFAULT_APP_ICON)?.alias).toBe('MainActivity');
    // The real activity is no longer a launcher itself.
    const activity = manifest.slice(manifest.indexOf('<activity\n'), manifest.indexOf('/>', manifest.indexOf('<activity\n')));
    expect(activity).toContain('.YouDoActivity');
  });

  it('ships generated assets for every icon', () => {
    for (const icon of APP_ICONS) {
      const suffix = icon.id === DEFAULT_APP_ICON ? '' : `_${icon.id}`;
      expect(existsSync(new URL(`../../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher${suffix}.xml`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher${suffix}_round.png`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../../public/app-icons/${icon.id}/manifest.webmanifest`, import.meta.url))).toBe(true);
    }
  });
});
