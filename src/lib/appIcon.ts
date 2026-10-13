import { Capacitor, registerPlugin } from '@capacitor/core';
import variantsConfig from './appIconVariants.json';
import { STORAGE_KEYS } from './storageKeys';

export interface AppIconVariant {
  id: string;
  label: string;
  alias: string;
  background: string;
  y: string;
  tick: string;
}

export const APP_ICON_MARK = variantsConfig.mark;
export const APP_ICONS: AppIconVariant[] = variantsConfig.variants;
export const DEFAULT_APP_ICON = variantsConfig.default;

const nativeIcon = registerPlugin<{
  getIcon(): Promise<{ current: string; pending?: string }>;
  setIcon(options: { id: string }): Promise<{ current: string; pending?: string }>;
}>('YouDoAppIcon');

export const supportsNativeAppIcon = () =>
  Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('YouDoAppIcon');

export function isAppIcon(id: unknown): id is string {
  return typeof id === 'string' && APP_ICONS.some((icon) => icon.id === id);
}

function storedWebIcon(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEYS.appIcon);
    return isAppIcon(id) ? id : DEFAULT_APP_ICON;
  } catch {
    return DEFAULT_APP_ICON;
  }
}

/** The icon the person chose (pending on Android until they leave the app). */
export async function getAppIcon(): Promise<string> {
  if (supportsNativeAppIcon()) {
    try {
      const { current, pending } = await nativeIcon.getIcon();
      const id = pending ?? current;
      return isAppIcon(id) ? id : DEFAULT_APP_ICON;
    } catch {
      return DEFAULT_APP_ICON;
    }
  }
  return storedWebIcon();
}

function setLink(rel: string, href: string, type?: string) {
  const selector = type ? `link[rel="${rel}"][type="${type}"]` : `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    if (type) link.type = type;
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.href = href;
}

/**
 * Web: the browser tab shows the chosen icon, and the web app manifest points
 * at it, so installing the web app uses it. (After install, browsers decide
 * whether to update the home-screen icon; a page cannot change it.)
 */
export function applyWebAppIcon(id = storedWebIcon()) {
  if (typeof document === 'undefined' || Capacitor.isNativePlatform()) return;
  const isDefault = id === DEFAULT_APP_ICON;
  const base = `/app-icons/${id}`;
  setLink('icon', isDefault ? '/icon.svg' : `${base}/icon.svg`, 'image/svg+xml');
  setLink('apple-touch-icon', isDefault ? '/apple-touch-icon.png' : `${base}/apple-touch-icon.png`);
  const manifest = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest) {
    if (!manifest.dataset.defaultHref) manifest.dataset.defaultHref = manifest.getAttribute('href') ?? '';
    const href = isDefault ? manifest.dataset.defaultHref : `${base}/manifest.webmanifest`;
    if (href && manifest.getAttribute('href') !== href) manifest.href = href;
  }
}

/** Saves the choice. Android swaps the home-screen icon when the app goes to the background. */
export async function setAppIcon(id: string): Promise<void> {
  if (!isAppIcon(id)) return;
  if (supportsNativeAppIcon()) {
    await nativeIcon.setIcon({ id });
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.appIcon, id);
  } catch {
    /* The tab icon still changes for this visit. */
  }
  applyWebAppIcon(id);
}
