import { TITLE_COUNTER_FROM, TITLE_MAX } from '../lib/titleLimit';

/** `52/60` beside a title field once it gets long; red when over the limit. */
export default function TitleCounter({ value, className = '' }: { value: string; className?: string }) {
  const length = value.trim().length;
  if (length < TITLE_COUNTER_FROM) return null;
  const over = length > TITLE_MAX;
  return (
    <span
      className={`pointer-events-none text-[11px] font-semibold tabular-nums ${over ? 'text-error' : 'text-content-muted'} ${className}`}
      aria-live="polite"
    >
      {length}/{TITLE_MAX}
    </span>
  );
}
