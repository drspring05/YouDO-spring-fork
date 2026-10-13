import type { CSSProperties } from 'react';

interface Props {
  /** 0–100 */
  progress: number;
  size?: number;
  stroke?: number;
}

/**
 * The day's progress around the header icon. The filled part glows and its
 * colour flows slowly along the arc like lava, in the accent colour. The flow
 * is a rotating gradient masked to the arc, so it runs on the GPU; with
 * Reduced Effects it rests as a still glow.
 */
export default function LavaRing({ progress, size = 54, stroke = 4 }: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const style = {
    width: size,
    height: size,
    '--p': clamped / 100,
    '--stroke': `${stroke}px`,
  } as CSSProperties;
  return (
    <span className="lava-ring" style={style} data-progress={Math.round(clamped)} aria-hidden="true">
      <span className="lava-ring-track" />
      {clamped > 0 && (
        <span className="lava-ring-glow">
          <span className="lava-ring-arc">
            <span className="lava-ring-flow" />
          </span>
          {clamped < 100 && (
            <>
              <span className="lava-ring-cap" />
              <span className="lava-ring-end"><span className="lava-ring-cap" /></span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
