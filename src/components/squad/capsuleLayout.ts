/** Input for one member's capsule. */
export interface CapsuleInput {
  id: string;
  name: string;
  percentRaw: number;
  overMs: number;
  targetMs: number;
}

export interface CapsuleLayout extends CapsuleInput {
  complete: boolean;
  /** Fill height, 0–100. */
  fillPercent: number;
  /** Bright cap for work beyond the bar, 0–35 % of the capsule. */
  extraPercent: number;
  /** Joined to the capsule above (gap and inner corners collapse). */
  weldTop: boolean;
  /** Joined to the capsule below. */
  weldBottom: boolean;
}

const MAX_EXTRA_PERCENT = 35;

/**
 * The room board's collective bar: lowest progress at the top, highest at
 * the bottom, so finished members gather at the base. A member who reaches
 * their bar welds to the capsule above, whether or not that member has
 * finished, and the welds cascade upward until everyone forms one bar.
 */
export function layoutCapsules(members: CapsuleInput[]): CapsuleLayout[] {
  const ordered = [...members].sort((a, b) => a.percentRaw - b.percentRaw || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const out: CapsuleLayout[] = ordered.map((m) => ({
    ...m,
    complete: m.percentRaw >= 100,
    fillPercent: Math.max(0, Math.min(100, m.percentRaw)),
    extraPercent: m.overMs > 0 && m.targetMs > 0 ? Math.min(MAX_EXTRA_PERCENT, Math.round((m.overMs / m.targetMs) * 100)) : 0,
    weldTop: false,
    weldBottom: false,
  }));
  for (let i = 1; i < out.length; i++) {
    if (out[i].complete) {
      out[i].weldTop = true;
      out[i - 1].weldBottom = true;
    }
  }
  return out;
}
