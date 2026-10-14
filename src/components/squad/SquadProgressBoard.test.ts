import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PaceRow } from '../../lib/paceBoard';
import SquadProgressBoard from './SquadProgressBoard';
import { layoutCapsules, type CapsuleInput } from './capsuleLayout';

const anchorISO = '2026-10-13';
const HOUR = 3_600_000;

function cap(id: string, percentRaw: number, overMs = 0, targetMs = 4 * HOUR): CapsuleInput {
  return { id, name: id, percentRaw, overMs, targetMs };
}

function paceRow(userId: string, todayHours: number, barHours = 4): PaceRow {
  return {
    userId,
    displayName: userId,
    examLabel: '',
    todayMs: todayHours * HOUR,
    weekMs: todayHours * HOUR,
    monthMs: todayHours * HOUR,
    todayKey: anchorISO,
    streak: 0,
    barHours,
    updatedAt: `${anchorISO}T10:00:00Z`,
  };
}

type Person = { id: string; hours: number | null; barHours?: number };

function boardProps(people: Person[], onOpenProfile?: (id: string) => void) {
  const paceByUserId: Record<string, PaceRow> = {};
  for (const p of people) if (p.hours !== null) paceByUserId[p.id] = paceRow(p.id, p.hours, p.barHours ?? 4);
  return {
    members: people.map((p) => ({ user_id: p.id, profiles: { display_name: p.id } })),
    paceByUserId,
    squadBarHours: 4,
    paceWindow: 'today' as const,
    anchorISO,
    currentUserId: people[0]?.id,
    emptyPaceRow: (id: string) => ({ ...paceRow(id, 0), updatedAt: '' }),
    onOpenProfile,
  };
}

const render = (people: Person[]) => renderToStaticMarkup(createElement(SquadProgressBoard, boardProps(people)));

/** Run the component's render (hooks included) and return its element tree. */
function elementTree(props: ReturnType<typeof boardProps>): ReactElement {
  let tree: ReactElement | null = null;
  function Harness() {
    tree = SquadProgressBoard(props) as ReactElement;
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  return tree!;
}

function findAll(node: ReactNode, match: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, match));
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  return [...(match(el) ? [el] : []), ...findAll(el.props.children as ReactNode, match)];
}

describe('collective bar layout', () => {
  it('puts the lowest progress at the top and the highest at the bottom', () => {
    const order = layoutCapsules([cap('high', 90), cap('low', 10), cap('mid', 50)]).map((c) => c.id);
    expect(order).toEqual(['low', 'mid', 'high']);
  });

  it('keeps a stable order for equal progress', () => {
    expect(layoutCapsules([cap('b', 40), cap('a', 40)]).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('keeps every capsule separate while nobody has reached the bar, 99% included', () => {
    const layout = layoutCapsules([cap('a', 0), cap('b', 50), cap('c', 99)]);
    expect(layout.every((c) => !c.complete && !c.weldTop && !c.weldBottom)).toBe(true);
  });

  it('welds a finished capsule to the one above it even if that member has not finished', () => {
    const [top, bottom] = layoutCapsules([cap('done', 100), cap('working', 30)]);
    expect(top.id).toBe('working');
    expect(top.weldBottom).toBe(true);
    expect(top.weldTop).toBe(false);
    expect(bottom.weldTop).toBe(true);
    expect(bottom.complete).toBe(true);
  });

  it('cascades upward as more members finish', () => {
    const layout = layoutCapsules([cap('a', 20), cap('b', 100), cap('c', 130), cap('d', 60)]);
    expect(layout.map((c) => c.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(layout.map((c) => [c.weldTop, c.weldBottom])).toEqual([
      [false, false],
      [false, true],
      [true, true],
      [true, false],
    ]);
  });

  it('forms one unbroken bar when everyone has finished', () => {
    const layout = layoutCapsules([cap('a', 100), cap('b', 120), cap('c', 100), cap('d', 150)]);
    expect(layout[0].weldTop).toBe(false);
    expect(layout[layout.length - 1].weldBottom).toBe(false);
    for (let i = 1; i < layout.length; i++) {
      expect(layout[i].weldTop && layout[i - 1].weldBottom).toBe(true);
    }
  });

  it('caps the fill at 100%, floors it at 0 and shows extra work as a capped cap', () => {
    const [negative, over, wayOver] = layoutCapsules([cap('n', -40), cap('o', 125, HOUR), cap('w', 400, 12 * HOUR)]);
    expect(negative.fillPercent).toBe(0);
    expect(over.fillPercent).toBe(100);
    expect(over.extraPercent).toBe(25);
    expect(wayOver.extraPercent).toBe(35);
    expect(negative.extraPercent).toBe(0);
  });

  it('handles a single member and an empty room', () => {
    const [solo] = layoutCapsules([cap('me', 100)]);
    expect(solo.weldTop || solo.weldBottom).toBe(false);
    expect(layoutCapsules([])).toEqual([]);
  });
});

describe('room progress board', () => {
  it('shows a clean empty state for a room without members', () => {
    const html = render([]);
    expect(html).toContain('No members yet');
    expect(html).not.toContain('NaN');
  });

  it('hides the collective label when you are alone and speaks about your own bar', () => {
    const html = render([{ id: 'me', hours: 2 }]);
    expect(html).not.toContain('Collective bar');
    expect(html).toContain('50% of your bar');
    expect(html).toContain('focused');
  });

  it('shows the collective label with its arrow in every shared room', () => {
    const two = render([{ id: 'a', hours: 1 }, { id: 'b', hours: 2 }]);
    expect(two).toContain('Collective bar');
    expect(two).toContain('M8 24V10');
    expect(two).toContain('--row:72px');
    const four = render([{ id: 'a', hours: 1 }, { id: 'b', hours: 2 }, { id: 'c', hours: 3 }, { id: 'd', hours: 4 }]);
    expect(four).toContain('Collective bar');
    expect(four).toContain('M8 44V10');
  });

  it('renders members lowest first and marks finished capsules', () => {
    const html = render([{ id: 'zed', hours: 4 }, { id: 'amy', hours: 1 }]);
    expect(html.indexOf('data-capsule="amy"')).toBeLessThan(html.indexOf('data-capsule="zed"'));
    expect(html).toMatch(/data-capsule="zed" data-weld="top" data-complete="true"/);
    expect(html).toMatch(/data-capsule="amy" data-weld="bottom" data-complete="false"/);
    expect(html).toContain('1 of 2 reached');
  });

  it('celebrates when everyone reached their bar', () => {
    const html = render([{ id: 'a', hours: 4 }, { id: 'b', hours: 5 }]);
    expect(html).toContain('Everyone reached their bar');
    expect(html).toContain('is-all-complete');
  });

  it('shows work beyond the bar like the Public Board does', () => {
    const html = render([{ id: 'a', hours: 6 }, { id: 'b', hours: 1 }]);
    expect(html).toContain('+2h over');
    expect(html).toContain('hub-capsule-extra');
  });

  it('says a member has not synced instead of showing a misleading 0%', () => {
    const html = render([{ id: 'me', hours: 1 }, { id: 'quiet', hours: null }]);
    expect(html).toContain('Not synced yet');
    expect(html).toContain('—');
  });

  it('gives every member an accessible profile button that opens their profile', () => {
    const spy = vi.fn();
    const tree = elementTree(boardProps([{ id: 'ada', hours: 4 }, { id: 'alan', hours: 1 }, { id: 'grace', hours: 2 }], spy));
    const buttons = findAll(tree, (el) => el.type === 'button' && String(el.props['aria-label'] ?? '').startsWith('View '));
    expect(buttons.map((b) => b.props['aria-label'])).toEqual([
      "View alan's profile",
      "View grace's profile",
      "View ada's profile",
    ]);
    for (const button of buttons) (button.props.onClick as () => void)();
    expect(spy.mock.calls.map(([id]) => id)).toEqual(['alan', 'grace', 'ada']);
  });

  it('does not throw when no profile handler is given', () => {
    const tree = elementTree(boardProps([{ id: 'solo', hours: 1 }]));
    const [button] = findAll(tree, (el) => el.type === 'button');
    expect(() => (button.props.onClick as () => void)()).not.toThrow();
  });
});
