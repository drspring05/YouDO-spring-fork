import motionCss from './motion.css?inline';
import { subscribeUiPrefs, uiPrefsSnapshot } from './hooks/useUiPrefs';

/**
 * Swaps the interface stylesheet between the redesign and the v7 look
 * (Settings → Appearance → Classic Look).
 *
 * The redesign's index.css loads the normal way, as the app's CSS file. The
 * v7 stylesheet is fetched only when Classic Look is on — it stays out of the
 * initial bundle — and while it is in, the redesign's sheet is disabled so
 * their identically named classes never fight. The shared motion styles are
 * injected last in <head>, so they read on top of either.
 */
const LEGACY_ID = 'youdo-legacy-css';
const MOTION_ID = 'youdo-motion-css';
const LEGACY_FONTS_ID = 'youdo-legacy-fonts';
const LEGACY_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap';

let wanted: boolean | null = null;

/** The redesign's stylesheet: the built app CSS file, or Vite's dev style tag for index.css. */
function modernSheets(): (HTMLLinkElement | HTMLStyleElement)[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style[data-vite-dev-id]')).filter((el) =>
    el instanceof HTMLLinkElement
      ? /\/assets\/app-[^/]*\.css$/.test(new URL(el.href, location.href).pathname)
      : (el.dataset.viteDevId ?? '').endsWith('/src/index.css'),
  );
}

function setModernEnabled(enabled: boolean) {
  for (const el of modernSheets()) {
    if (el instanceof HTMLLinkElement) el.disabled = !enabled;
    else el.media = enabled ? '' : 'not all';
  }
}

function ensureMotion() {
  if (document.getElementById(MOTION_ID)) return;
  const style = document.createElement('style');
  style.id = MOTION_ID;
  style.textContent = motionCss;
  document.head.appendChild(style);
}

function setLegacyFonts(on: boolean) {
  const fonts = document.getElementById(LEGACY_FONTS_ID);
  if (on && !fonts) {
    const link = document.createElement('link');
    link.id = LEGACY_FONTS_ID;
    link.rel = 'stylesheet';
    link.href = LEGACY_FONTS_URL;
    document.head.appendChild(link);
  } else if (!on && fonts) {
    fonts.remove();
  }
}

async function apply(legacy: boolean, firstPaint: boolean) {
  if (wanted === legacy) return;
  wanted = legacy;
  document.documentElement.dataset.uiStyle = legacy ? 'legacy' : 'modern';
  setLegacyFonts(legacy);

  if (!legacy) {
    document.getElementById(LEGACY_ID)?.remove();
    setModernEnabled(true);
    return;
  }

  // Opening straight into Classic Look: hold the first paint for the v7 sheet
  // rather than flash the redesign (never longer than a moment).
  const root = document.documentElement;
  const reveal = () => root.style.removeProperty('visibility');
  if (firstPaint) {
    root.style.visibility = 'hidden';
    window.setTimeout(reveal, 1500);
  }
  try {
    const { default: legacyCss } = await import('./legacy/legacy.css?inline');
    if (wanted !== true) return;
    let style = document.getElementById(LEGACY_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = LEGACY_ID;
      const motion = document.getElementById(MOTION_ID);
      document.head.insertBefore(style, motion);
    }
    style.textContent = legacyCss;
    setModernEnabled(false);
  } finally {
    reveal();
  }
}

export function installUiStyle() {
  ensureMotion();
  void apply(uiPrefsSnapshot().legacyStyle, true);
  subscribeUiPrefs(() => void apply(uiPrefsSnapshot().legacyStyle, false));
}
