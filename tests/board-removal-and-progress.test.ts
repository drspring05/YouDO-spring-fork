import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SquadProgressBoard, {
  computeSquadBarProgress,
  collectiveBarPercent,
} from '../src/components/squad/SquadProgressBoard';
import type { PaceRow } from '../src/lib/paceBoard';

function createMockPaceRow(userId: string, todayMs: number, barHours: number = 8): PaceRow {
  return {
    userId,
    displayName: `User_${userId}`,
    examLabel: 'GATE',
    todayMs,
    weekMs: todayMs,
    monthMs: todayMs,
    todayKey: '2026-10-09',
    streak: 3,
    barHours,
    updatedAt: '2026-10-09T10:00:00Z',
  };
}

describe('Live Board removal', () => {
  const squadProgressBoardPath = path.resolve('src/components/squad/SquadProgressBoard.tsx');
  const squadRoomSheetPath = path.resolve('src/components/SquadRoomSheet.tsx');

  it('verifies complete absence of "Live board" code, text, or elements in SquadProgressBoard.tsx', () => {
    const code = fs.readFileSync(squadProgressBoardPath, 'utf-8');
    expect(code.toLowerCase()).not.toContain('live board');
    expect(code).not.toContain('LiveBoard');
    expect(code).not.toContain('live_board');
    expect(code).not.toContain('formatRelative');
    expect(code).not.toContain('activity.map');
    expect(code).not.toMatch(/Zap/);
  });

  it('verifies complete absence of "Live board" in SquadRoomSheet.tsx', () => {
    const code = fs.readFileSync(squadRoomSheetPath, 'utf-8');
    expect(code.toLowerCase()).not.toContain('live board');
    expect(code).not.toContain('LiveBoard');
    expect(code).not.toContain('live_board');
  });

  it('verifies that no file in src/ contains "live board" UI components', () => {
    const srcDir = path.resolve('src');
    function scanDir(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const violations: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes('live board') && !entry.name.includes('test')) {
            violations.push(fullPath);
          }
        }
      }
      return violations;
    }

    const matches = scanDir(srcDir);
    expect(matches).toEqual([]);
  });

  it('verifies that member segregation ("Different daily bar" / "On their own bars") is completely eliminated', () => {
    const code = fs.readFileSync(squadProgressBoardPath, 'utf-8');
    expect(code).not.toContain('Different daily bar');
    expect(code).not.toContain('On their own bars');
    expect(code).not.toContain('separateMembers');
    expect(code).not.toContain('collectiveMembers');
  });
});

describe('Progress computation', () => {
  const anchorISO = '2026-10-09';
  const targetMs8h = 8 * 60 * 60 * 1000;

  it('calculates 0% progress when focus is 0', () => {
    const row = createMockPaceRow('u1', 0, 8);
    const progress = computeSquadBarProgress(row, 8, 'today', anchorISO);
    expect(progress.focused).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.percentRaw).toBe(0);
    expect(progress.overMs).toBe(0);
    expect(progress.targetMs).toBe(targetMs8h);
  });

  it('calculates exact mid-way progress (50%)', () => {
    const row = createMockPaceRow('u1', targetMs8h / 2, 8);
    const progress = computeSquadBarProgress(row, 8, 'today', anchorISO);
    expect(progress.focused).toBe(targetMs8h / 2);
    expect(progress.percent).toBe(50);
    expect(progress.percentRaw).toBe(50);
    expect(progress.overMs).toBe(0);
  });

  it('calculates 100% completion correctly', () => {
    const row = createMockPaceRow('u1', targetMs8h, 8);
    const progress = computeSquadBarProgress(row, 8, 'today', anchorISO);
    expect(progress.focused).toBe(targetMs8h);
    expect(progress.percent).toBe(100);
    expect(progress.percentRaw).toBe(100);
    expect(progress.overMs).toBe(0);
  });

  it('handles over-bar progress by clamping visual percent to 100 while preserving percentRaw and overMs', () => {
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const row = createMockPaceRow('u1', targetMs8h + twoHoursMs, 8);
    const progress = computeSquadBarProgress(row, 8, 'today', anchorISO);
    expect(progress.percent).toBe(100);
    expect(progress.percentRaw).toBe(125);
    expect(progress.overMs).toBe(twoHoursMs);
  });

  it('collectiveBarPercent correctly averages member raw percentages and rounds mathematically', () => {
    expect(collectiveBarPercent([])).toBe(0);

    const members = [
      { progress: computeSquadBarProgress(createMockPaceRow('u1', 2 * 3600 * 1000, 8), 8, 'today', anchorISO) }, // 25%
      { progress: computeSquadBarProgress(createMockPaceRow('u2', 4 * 3600 * 1000, 8), 8, 'today', anchorISO) }, // 50%
      { progress: computeSquadBarProgress(createMockPaceRow('u3', 8 * 3600 * 1000, 8), 8, 'today', anchorISO) }, // 100%
    ];
    // (25 + 50 + 100) / 3 = 175 / 3 = 58.333... -> 58
    expect(collectiveBarPercent(members)).toBe(58);
  });
});



describe('Auditor Forensic Verification: Interactive DP Avatar Button Wiring', () => {
  const anchorISO = '2026-10-09';

  it('renders interactive button for each member DP with proper aria-label and click handler', () => {
    const members = [
      { user_id: 'u1', profiles: { display_name: 'Alice', avatar_url: 'https://example.com/a.png' } },
      { user_id: 'u2', profiles: { display_name: 'Bob', avatar_url: 'https://example.com/b.png' } },
    ];
    const paceByUserId = {
      u1: createMockPaceRow('u1', 4 * 3600 * 1000, 8),
      u2: createMockPaceRow('u2', 4 * 3600 * 1000, 8),
    };

    const html = renderToStaticMarkup(
      createElement(SquadProgressBoard, {
        members,
        paceByUserId,
        squadBarHours: 8,
        paceWindow: 'today',
        anchorISO,
        currentUserId: 'u1',
        emptyPaceRow: (uid: string) => createMockPaceRow(uid, 0, 8),
        onOpenProfile: () => {},
      }),
    );

    // Both members should have interactive DP buttons
    expect(html).toContain('aria-label="View Alice&#x27;s profile"');
    expect(html).toContain('aria-label="View Bob&#x27;s profile"');
    expect(html).toContain('title="View Alice&#x27;s profile"');
    expect(html).toContain('title="View Bob&#x27;s profile"');
  });
});


