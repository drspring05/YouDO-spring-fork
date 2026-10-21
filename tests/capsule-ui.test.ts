import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SquadProgressBoard from '../src/components/squad/SquadProgressBoard';
import type { PaceRow } from '../src/lib/paceBoard';

const anchorISO = '2026-10-09';

function createPaceRow(userId: string, hours: number, barHours = 8): PaceRow {
  return {
    userId,
    displayName: `User ${userId}`,
    examLabel: 'GATE',
    todayMs: hours * 3600000,
    weekMs: hours * 3600000,
    monthMs: hours * 3600000,
    todayKey: anchorISO,
    streak: 1,
    barHours,
    updatedAt: '2026-10-09T10:00:00Z',
  };
}

function renderBoard(
  membersData: { id: string; name: string; hours: number; barHours?: number }[],
  currentUserId = 'u1',
) {
  const members = membersData.map((m) => ({
    user_id: m.id,
    profiles: { display_name: m.name, avatar_url: '' },
  }));

  const paceByUserId: Record<string, PaceRow> = {};
  for (const m of membersData) {
    paceByUserId[m.id] = createPaceRow(m.id, m.hours, m.barHours ?? 8);
  }

  const emptyPaceRow = (uid: string): PaceRow => createPaceRow(uid, 0, 8);

  const element = createElement(SquadProgressBoard, {
    members,
    paceByUserId,
    squadBarHours: 8,
    paceWindow: 'today',
    anchorISO,
    currentUserId,
    viewerBarHours: 8,
    emptyPaceRow,
  });

  return renderToStaticMarkup(element);
}

describe('Capsule UI and visual merging', () => {
  // ---------------------------------------------------------------------------
  // 7. Complete Absence of "Live Board" DOM elements, imports, or state
  // ---------------------------------------------------------------------------
  it('Absence of Live Board: zero occurrences of "Live board" in rendered HTML', () => {
    const html = renderBoard([
      { id: 'u1', name: 'Alice', hours: 5 },
      { id: 'u2', name: 'Bob', hours: 8 },
    ]);
    expect(html.toLowerCase()).not.toContain('live board');
    expect(html.toLowerCase()).not.toContain('liveboard');
    expect(html).not.toContain('No synced focus yet');
    expect(html).not.toContain('Dynamic activity board');
  });

  // ---------------------------------------------------------------------------
  // 9. Interactive DP button wiring
  // ---------------------------------------------------------------------------
  it('Interactive DP button wiring: each member row includes an accessible profile button', () => {
    const html = renderBoard([
      { id: 'u1', name: 'Alice', hours: 2 },
      { id: 'u2', name: 'Bob', hours: 3 },
    ]);

    expect(html).toMatch(/aria-label="View Alice(&#x27;|')s profile"/);
    expect(html).toMatch(/title="View Alice(&#x27;|')s profile"/);
    expect(html).toMatch(/aria-label="View Bob(&#x27;|')s profile"/);
    expect(html).toMatch(/title="View Bob(&#x27;|')s profile"/);
  });
});
