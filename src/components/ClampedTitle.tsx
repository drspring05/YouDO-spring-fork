import { useLayoutEffect, useRef, useState } from 'react';

type Props = {
  text: string;
  className?: string;
  as?: 'h2' | 'h3';
  /** Opens the full text; without it the "…" is shown but not tappable. */
  onMore?: () => void;
};

/** How far back a cut may move to end on a whole word. */
const WORD_BACKTRACK = 12;

/**
 * A title clipped to the height its CSS allows (e.g. two lines). When it does
 * not fit, it ends on the last word that fits followed by a softly tinted "…",
 * and only that "…" opens the full text; the rest of the title stays plain, so
 * tapping it does what the card does.
 */
export default function ClampedTitle({ text, className = '', as: Tag = 'h3', onMore }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  /** The visible part when cut; null when the whole title fits. */
  const [shown, setShown] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;

    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width === lastWidth) return;
      lastWidth = width;
      // A hidden copy with the same classes and width finds the longest
      // start of the title that still fits with the "…" after it.
      const probe = el.cloneNode(false) as HTMLElement;
      probe.removeAttribute('id');
      probe.setAttribute('aria-hidden', 'true');
      Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: '0', top: '0', width: `${width}px` });
      el.parentElement?.appendChild(probe);
      const fits = (value: string) => {
        probe.textContent = value;
        return probe.scrollHeight <= probe.clientHeight + 1;
      };
      let next: string | null = null;
      if (!fits(text)) {
        let lo = 0;
        let hi = text.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (fits(`${text.slice(0, mid).trimEnd()}…`)) lo = mid;
          else hi = mid - 1;
        }
        let end = lo;
        const space = text.lastIndexOf(' ', end);
        if (space > 0 && end - space <= WORD_BACKTRACK && end < text.length && text[end] !== ' ') end = space;
        next = text.slice(0, end).trimEnd();
      }
      probe.remove();
      setShown(next);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const cut = shown !== null;
  return (
    <Tag ref={ref} className={`clamped-title ${className}`} aria-label={cut ? text : undefined}>
      {cut ? shown : text}
      {cut && (onMore ? (
        <button
          type="button"
          className="clamped-title-more"
          onClick={(e) => {
            e.stopPropagation();
            onMore();
          }}
          aria-label="Show the full name"
          title="Show the full name"
        >
          …
        </button>
      ) : (
        <span aria-hidden="true">…</span>
      ))}
    </Tag>
  );
}
