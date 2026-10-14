import { Link2 } from 'lucide-react';

type Props = {
  /** The first one or two names on the way to the item. */
  names: string[];
  /** Jumps to the item in Goals; without it the chip is just a label. */
  onClick?: () => void;
  className?: string;
};

/**
 * Where an item lives: a small bordered chip with a link mark, used the same
 * way on Today, Goals and Calendar. It stays on one line; a name that does
 * not fit ends in "…", and a longer name gives up more room.
 */
export default function OriginChip({ names, onClick, className = '' }: Props) {
  if (names.length === 0) return null;
  return (
    <span
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={onClick ? 'Jump to this task in Goals' : undefined}
      className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg border border-subtle bg-elevated px-2 py-0.5 text-[10px] font-extrabold leading-normal shadow-xs ${
        onClick ? 'cursor-pointer transition-all hover:border-primary/20 hover:bg-surface' : ''
      } ${className}`}
    >
      <Link2 size={10} className="mr-0.5 shrink-0 text-primary" />
      {names.map((name, i) => (
        <span key={i} className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate text-primary-glow">{name}</span>
          {i < names.length - 1 && <span className="shrink-0 text-content-muted">•</span>}
        </span>
      ))}
    </span>
  );
}
