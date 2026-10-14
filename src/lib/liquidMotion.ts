/**
 * The physics shared by YouDO's liquid glass surfaces — the tab bar's pill
 * and the briefing slider's knob: hand-stepped springs and the speed stretch.
 */

/** Semi-implicit Euler in 1/240 s sub-steps, so a long frame cannot blow it up. */
export function springStep(x: number, v: number, target: number, dt: number, stiffness: number, damping: number): [number, number] {
  let t = dt;
  let px = x;
  let pv = v;
  while (t > 0) {
    const step = Math.min(t, 1 / 240);
    const accel = -stiffness * (px - target) - damping * pv;
    pv += accel * step;
    px += pv * step;
    t -= step;
  }
  return [px, pv];
}

/** A spring step snapped to its target once it has nothing left to say. */
export function stepLift(x: number, v: number, target: number, dt: number, stiffness: number, damping: number): [number, number] {
  const [nx, nv] = springStep(x, v, target, dt, stiffness, damping);
  return Math.abs(nx - target) < 0.0008 && Math.abs(nv) < 0.01 ? [target, 0] : [nx, nv];
}

/**
 * Speed to stretch: the pill grows wide and flat in proportion to how fast it
 * is moving, eased so a single noisy frame cannot flick it.
 *
 * BitChord's pill (after liquid_glass_easy) deforms with acceleration. That
 * force flips sign half way through every trip — launch, then brake — so the
 * pill stretched, snapped back to round and stretched again, which read as
 * abrupt. Speed rises and falls once per trip, so the stretch is one smooth
 * swell, peaking mid-flight and gone by the landing.
 */
export class StretchModel {
  /** Stretch per px/s of speed, its cap, and how quickly it follows. */
  private static SENSITIVITY = 0.00016;
  private static MAX_STRETCH = 0.1;
  private static RESPONSE_TIME = 0.05;

  private last: number | null = null;
  private value = 0;

  reset() {
    this.last = null;
    this.value = 0;
  }

  /** The stretch as of the last [track], without sampling again. */
  get current() {
    return this.value;
  }

  track(x: number, dt: number): number {
    if (this.last === null || dt <= 0) {
      this.last = x;
      return this.value;
    }
    const speed = Math.abs(x - this.last) / dt;
    this.last = x;
    const raw = Math.min(StretchModel.MAX_STRETCH, speed * StretchModel.SENSITIVITY);
    this.value += (raw - this.value) * (1 - Math.exp(-dt / StretchModel.RESPONSE_TIME));
    if (this.value < 0.0004 && raw === 0) this.value = 0;
    return this.value;
  }
}
