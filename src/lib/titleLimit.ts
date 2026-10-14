/**
 * Titles stay short so every card reads cleanly; longer detail belongs in the
 * item's Description. Steps have no description, so they are not limited.
 */
export const TITLE_MAX = 60;

/** The counter appears once a title gets this long. */
export const TITLE_COUNTER_FROM = 45;

/** The hint shown under title fields that also have a Description. */
export const TITLE_HINT = 'Keep the name short. Add details in Description.';

export function isTitleTooLong(text: string): boolean {
  return text.trim().length > TITLE_MAX;
}

/** 1-based numbers of the lines whose title is over the limit. */
export function longLines(lines: string[]): number[] {
  const out: number[] = [];
  lines.forEach((line, i) => {
    if (isTitleTooLong(line)) out.push(i + 1);
  });
  return out;
}

/** A short message naming the over-limit lines, or null when all fit. */
export function longLinesMessage(lines: string[]): string | null {
  const long = longLines(lines);
  if (long.length === 0) return null;
  const which = long.length === 1 ? `Line ${long[0]} is` : `Lines ${long.slice(0, 3).join(', ')}${long.length > 3 ? '…' : ''} are`;
  return `${which} over ${TITLE_MAX} characters. Keep names short.`;
}
