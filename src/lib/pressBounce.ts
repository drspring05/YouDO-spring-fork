import { Spring, Stiffness } from './spring';
import { motionAllowed, uiPrefsSnapshot } from '../hooks/useUiPrefs';

/**
 * The liquid-glass button response, for every icon button in the app at once:
 * it swells under the finger, leans a few px after a drag with steep
 * resistance — stretching along the drag and squeezing across it, like a drop
 * — and on release springs home past its spot once before settling.
 *
 * Installed once as a delegated listener, so new screens and sheets get it
 * without any wiring. Purely visual: it never cancels or consumes the pointer,
 * so clicks, scrolls and swipes behave exactly as before. It moves the button
 * with the individual `scale` and `translate` properties, which compose with
 * whatever `transform` the button already has for its own layout.
 *
 * Which buttons: anything marked `data-bounce`, the floating glass controls,
 * and any button whose only content is an icon (back, close, account, more…)
 * up to 72px. Buttons with text labels keep their usual press style.
 *
 * While one is held, the page does not scroll from it: Android otherwise
 * claims the first sideways or upward drag as a scroll, cancels the press,
 * and the button snaps home under a finger that is still on it.
 *
 * On with Settings → Appearance → Liquid Glass. Constants are BitChord's
 * GlassPress, which is the same response on its glass buttons.
 */

const PRESSED_SCALE = 1.06;
/** The furthest a held button follows the finger, however far the finger goes. */
const MAX_FOLLOW = 5;
/** Stretch along the drag at full follow; it squeezes across by half as much. */
const PRESS_STRETCH = 0.07;
/** Under-damped on purpose: the button overshoots its spot once and settles. */
const RELEASE_DAMPING = 0.5;
const MAX_ICON_BUTTON = 72;

const SELECTOR = 'button, a[href], [role="button"]';
const ALWAYS = '[data-bounce], .glass, .fab, .tab-bar-orb, .app-header-button';

interface PressState {
  scale: Spring;
  ox: Spring;
  oy: Spring;
  frame: number;
  last: number;
}

const states = new WeakMap<HTMLElement, PressState>();

function isEligible(el: HTMLElement): boolean {
  if (el.matches('[data-no-bounce], :disabled, [aria-disabled="true"]')) return false;
  if (el.closest('.tab-bar-tabs')) return false; // the tab pill already answers these
  if (el.matches(ALWAYS)) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width > MAX_ICON_BUTTON || rect.height > MAX_ICON_BUTTON) return false;
  if ((el.textContent ?? '').trim().length > 0) return false;
  return el.querySelector('svg, img') !== null;
}

function render(el: HTMLElement, s: PressState) {
  const ox = s.ox.value;
  const oy = s.oy.value;
  const fx = Math.abs(ox) / MAX_FOLLOW;
  const fy = Math.abs(oy) / MAX_FOLLOW;
  const sx = s.scale.value * (1 + PRESS_STRETCH * (fx - fy / 2));
  const sy = s.scale.value * (1 + PRESS_STRETCH * (fy - fx / 2));
  el.style.scale = `${sx.toFixed(4)} ${sy.toFixed(4)}`;
  el.style.translate = `${ox.toFixed(2)}px ${oy.toFixed(2)}px`;
}

function run(el: HTMLElement, s: PressState) {
  if (s.frame) return;
  s.last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    s.scale.step(dt);
    s.ox.step(dt);
    s.oy.step(dt);
    render(el, s);
    const pressed = el.classList.contains('is-pressing');
    if (!pressed && s.scale.isAtRest(0.0005) && s.ox.isAtRest(0.02) && s.oy.isAtRest(0.02)) {
      s.frame = 0;
      el.style.removeProperty('scale');
      el.style.removeProperty('translate');
      el.classList.remove('is-bouncing');
      states.delete(el);
      return;
    }
    s.frame = requestAnimationFrame(tick);
  };
  s.frame = requestAnimationFrame(tick);
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !event.isPrimary) return;
  const prefs = uiPrefsSnapshot();
  if (!prefs.liquidGlass || !motionAllowed()) return;
  const el = (event.target as Element | null)?.closest<HTMLElement>(SELECTOR);
  if (!el || !isEligible(el)) return;

  let s = states.get(el);
  if (!s) {
    s = {
      scale: new Spring(1, Stiffness.Medium, 0.6),
      ox: new Spring(0, Stiffness.Medium, 0.6),
      oy: new Spring(0, Stiffness.Medium, 0.6),
      frame: 0,
      last: 0,
    };
    states.set(el, s);
  }
  const state = s;
  state.scale.configure(Stiffness.Medium, 0.6);
  state.scale.target = PRESSED_SCALE;
  el.classList.add('is-bouncing', 'is-pressing');
  run(el, state);

  const startX = event.clientX;
  const startY = event.clientY;
  const id = event.pointerId;

  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const distance = Math.hypot(dx, dy);
    // Approaches MAX_FOLLOW and never passes it: the first few px of drag
    // move the button almost one for one, the rest barely at all.
    const k = distance > 0 ? (MAX_FOLLOW * (1 - Math.exp(-distance / (MAX_FOLLOW * 3)))) / distance : 0;
    state.ox.snap(dx * k);
    state.oy.snap(dy * k);
    run(el, state);
  };
  // Keep the page from turning this press into a scroll (see above).
  const holdScroll = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
  };
  const release = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    window.removeEventListener('touchmove', holdScroll, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
    el.classList.remove('is-pressing');
    // Under-damped on purpose: the button overshoots its spot once and settles.
    // The offset carries the stretch, so the same spring takes it through
    // its overshoot too — stretched one way, squeezed past round, settled.
    state.scale.configure(Stiffness.MediumLow, RELEASE_DAMPING);
    state.ox.configure(Stiffness.MediumLow, RELEASE_DAMPING);
    state.oy.configure(Stiffness.MediumLow, RELEASE_DAMPING);
    state.scale.target = 1;
    state.ox.target = 0;
    state.oy.target = 0;
    run(el, state);
  };
  window.addEventListener('touchmove', holdScroll, { capture: true, passive: false });
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
}

let installed = false;
export function installPressBounce() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
}
