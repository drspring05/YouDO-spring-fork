import { describe, expect, it } from 'vitest';
import { TITLE_MAX, isTitleTooLong, longLines, longLinesMessage } from './titleLimit';
import { parseGeneratedBlueprint } from './aiPlan';

const long = 'x'.repeat(TITLE_MAX + 1);

describe('title limit', () => {
  it('allows titles up to the limit, ignoring surrounding spaces', () => {
    expect(isTitleTooLong('x'.repeat(TITLE_MAX))).toBe(false);
    expect(isTitleTooLong(`  ${'x'.repeat(TITLE_MAX)}  `)).toBe(false);
    expect(isTitleTooLong(long)).toBe(true);
  });

  it('names the over-limit lines of a list', () => {
    expect(longLines(['ok', long, '', long])).toEqual([2, 4]);
    expect(longLinesMessage(['ok', 'fine'])).toBeNull();
    expect(longLinesMessage(['ok', long])).toBe(`Line 2 is over ${TITLE_MAX} characters. Keep names short.`);
    expect(longLinesMessage([long, long, long, long, long])).toContain('Lines 1, 2, 3… are');
  });

  it('rejects an AI plan with a title over the limit and points to description', () => {
    const plan = {
      tasks: [],
      goals: [{ kind: 'goal', title: 'Goal', children: [{ kind: 'node', title: long, children: [], steps: ['Do it'] }] }],
    };
    const result = parseGeneratedBlueprint(JSON.stringify(plan));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(`title is over ${TITLE_MAX} characters`);
  });
});
