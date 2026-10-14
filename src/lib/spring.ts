/**
 * A unit-mass damped spring, stepped by hand from a requestAnimationFrame loop.
 *
 * Configured the way Compose and SwiftUI describe springs — a stiffness and a
 * damping ratio (1 settles without overshoot, lower bounces) — and always
 * re-targeted from its current value and velocity, so motion can be redirected
 * mid-flight without a jump.
 */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  stiffness: number;
  damping: number;

  constructor(value: number, stiffness: number, dampingRatio: number) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = 2 * dampingRatio * Math.sqrt(stiffness);
  }

  configure(stiffness: number, dampingRatio: number) {
    this.stiffness = stiffness;
    this.damping = 2 * dampingRatio * Math.sqrt(stiffness);
  }

  snap(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  /** Advances by `dt` seconds, in sub-steps small enough to stay stable on stiff springs. */
  step(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += force * h;
      this.value += this.velocity * h;
    }
  }

  isAtRest(epsilon = 0.001) {
    return Math.abs(this.value - this.target) < epsilon && Math.abs(this.velocity) < epsilon * 10;
  }
}

/** Compose's named stiffness levels, for springs ported from Android. */
export const Stiffness = {
  High: 10_000,
  Medium: 1_500,
  MediumLow: 400,
  Low: 200,
} as const;
