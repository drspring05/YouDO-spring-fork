interface Props {
  /** 0–100 */
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
  /** Override the tint (defaults to the app accent). */
  color?: string;
}

/** Apple Fitness-style progress ring; the stroke animates on change. */
export default function ActivityRing({ progress, size = 44, stroke = 6, label, color }: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;
  return (
    <svg
      className="activity-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        className="activity-ring-track"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        style={color ? { stroke: `color-mix(in srgb, ${color} 24%, transparent)` } : undefined}
      />
      <circle
        className="activity-ring-value"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ opacity: clamped === 0 ? 0 : 1, ...(color ? { stroke: color } : {}) }}
      />
      {label && (
        <text className="activity-ring-label" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
          {label}
        </text>
      )}
    </svg>
  );
}
