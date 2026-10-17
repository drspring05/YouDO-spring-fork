import { useEffect, useRef } from 'react';

interface Props {
  /** what each position shows; position 0 is usually a "—" placeholder */
  items: string[];
  /** the position currently chosen */
  index: number;
  onIndexChange: (index: number) => void;
  /** read out by screen readers, e.g. "Month" */
  label: string;
  /** greyed out while no value is chosen */
  muted?: boolean;
}

/** Height of one value; the window shows exactly one at a time, like a scroll lock. */
const ITEM_HEIGHT = 32;

/**
 * A small scroll wheel that shows one value at a time. Drag or swipe it up and down and it snaps to the
 * next value. Used for the month and day of a step in the Plan sheet.
 */
export default function ScrollWheel({ items, index, onIndexChange, label, muted = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  const lastReported = useRef(index);

  // Follow the chosen position when it changes from outside (the list changed, or the date was cleared).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    lastReported.current = index;
    const target = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [index, items.length]);

  useEffect(
    () => () => {
      if (settle.current !== null) window.clearTimeout(settle.current);
    },
    [],
  );

  const onScroll = () => {
    if (settle.current !== null) window.clearTimeout(settle.current);
    // Wait until the wheel stops moving before reading where it landed.
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const next = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
      if (next !== lastReported.current) {
        lastReported.current = next;
        onIndexChange(next);
      }
    }, 90);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, items.length - 1)}
      aria-valuetext={items[index]}
      onScroll={onScroll}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const next = Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
          if (next !== index) onIndexChange(next);
        }
      }}
      className="overflow-y-scroll overscroll-contain snap-y snap-mandatory no-scrollbar rounded-lg bg-elevated border border-subtle outline-none focus-visible:border-primary"
      style={{ height: ITEM_HEIGHT, touchAction: 'pan-y' }}
    >
      {items.map((text, i) => (
        <div
          key={`${i}:${text}`}
          className={`snap-center grid place-items-center text-[12px] font-bold tabular-nums select-none ${
            muted && i === index ? 'text-content-muted' : 'text-content-primary'
          }`}
          style={{ height: ITEM_HEIGHT, scrollSnapStop: 'always' }}
        >
          {text}
        </div>
      ))}
    </div>
  );
}
