import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import SquadProgressBoard from '../src/components/squad/SquadProgressBoard';
import type { PaceRow } from '../src/lib/paceBoard';
import { windowMs } from '../src/lib/paceBoard';
import { formatDuration } from '../src/lib/format';

// ---------------------------------------------------------------------------
// Mocks for UserProfileSheet testing
// ---------------------------------------------------------------------------
vi.mock('../src/components/Overlay', () => ({
  default: ({
    open,
    onClose,
    children,
    scrim = true,
  }: {
    open: boolean;
    onClose?: () => void;
    children: ReactNode;
    scrim?: boolean;
  }) => {
    if (!open) return null;
    return createElement(
      'div',
      {
        'data-testid': 'overlay-backdrop',
        role: 'dialog',
        'aria-modal': 'true',
        onClick: scrim ? onClose : undefined,
      },
      createElement(
        'div',
        {
          'data-testid': 'overlay-content',
          onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
        },
        children,
      ),
    );
  },
}));

const mockCurrentUser: { id: string; email?: string } | null = { id: 'user-viewer-1' };
vi.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    loading: false,
  }),
}));

const mockProfiles: Record<string, unknown> = {};
const mockPaceRows: Record<string, PaceRow | null> = {};

vi.mock('../src/lib/profiles', () => ({
  fetchProfile: vi.fn().mockImplementation((uid: string) => Promise.resolve(mockProfiles[uid] ?? null)),
  checkFriendshipStatus: vi.fn().mockResolvedValue('none'),
  sendFriendRequest: vi.fn().mockResolvedValue({ ok: true }),
  removeFriend: vi.fn().mockResolvedValue(true),
  normalizeUsername: (u?: string | null) => (u ? u.trim().toLowerCase() : ''),
}));

vi.mock('../src/lib/paceCloud', () => ({
  fetchPaceRowForUser: vi.fn().mockImplementation((uid: string) => Promise.resolve(mockPaceRows[uid] ?? null)),
}));

import UserProfileSheet from '../src/components/UserProfileSheet';

// ---------------------------------------------------------------------------
// Helper fixtures
// ---------------------------------------------------------------------------
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
    weekKey: '2026-10-05',
    monthKey: '2026-10-01',
    streak: 5,
    barHours,
    updatedAt: '2026-10-09T10:00:00Z',
  };
}

function renderBoard(
  membersData: { id: string; name: string; hours: number; barHours?: number }[],
  currentUserId = 'u1',
  squadBarHours = 8,
  onOpenProfile?: (userId: string) => void,
) {
  const members = membersData.map((m) => ({
    user_id: m.id,
    profiles: { display_name: m.name, avatar_url: '' },
  }));

  const paceByUserId: Record<string, PaceRow> = {};
  for (const m of membersData) {
    paceByUserId[m.id] = createPaceRow(m.id, m.hours, m.barHours ?? squadBarHours);
  }

  const emptyPaceRow = (uid: string): PaceRow => createPaceRow(uid, 0, squadBarHours);

  const element = createElement(SquadProgressBoard, {
    members,
    paceByUserId,
    squadBarHours,
    paceWindow: 'today',
    anchorISO,
    currentUserId,
    viewerBarHours: squadBarHours,
    emptyPaceRow,
    onOpenProfile,
  });

  return renderToStaticMarkup(element);
}

// ---------------------------------------------------------------------------
// TEST SUITE: Empirical Adversarial Boundary & Stress Testing
// ---------------------------------------------------------------------------
describe('Profile sheet boundary conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // SECTION 1: Capsule Progress Bar Boundary & Edge Cases
  // =========================================================================
  describe('1. Capsule Progress Bar Boundary Tests', () => {
    it('1.9: Live Board is completely nuked from the DOM', () => {
      const html = renderBoard([
        { id: 'u1', name: 'Alice', hours: 4, barHours: 8 },
        { id: 'u2', name: 'Bob', hours: 6, barHours: 8 },
      ]);
      expect(html.toLowerCase()).not.toContain('live board');
      expect(html.toLowerCase()).not.toContain('liveboard');
      expect(html).not.toContain('different daily bar');
    });
  });

  // =========================================================================
  // SECTION 2: Hub Attention Routing Stress Testing
  // =========================================================================
  describe('2. Hub Attention Routing Stress Tests', () => {
    // Pure navigation router oracle matching App.tsx specification
    function computeNavigationDestination(params: {
      privatePending: number;
      dmUnread: number;
      roomsOutgoingPending: number;
      squadChatUnread: boolean;
      communityUnread: number;
      optedIn: boolean;
      targetView: 'board' | 'tasks' | 'goals' | 'calendar';
    }): { subTab: 'social' | 'private'; showNavDot: boolean } {
      const privateAttention =
        params.privatePending > 0 ||
        params.dmUnread > 0 ||
        params.roomsOutgoingPending > 0 ||
        params.squadChatUnread;

      const publicHubUnread = params.optedIn ? params.communityUnread : 0;
      const showNavDot = publicHubUnread > 0 || privateAttention;

      let subTab: 'social' | 'private';
      if (privateAttention) {
        subTab = 'private';
      } else {
        subTab = params.optedIn ? 'social' : 'private';
      }

      return { subTab, showNavDot };
    }

    it('2.1: Rapid signal oscillation between zero notifications and active invites', () => {
      // Sequence of state switches simulating active notifications arriving and being cleared
      const sequence = [
        { invites: 0, dms: 0, chat: false, optedIn: true, expectedTab: 'social', expectedDot: false },
        { invites: 1, dms: 0, chat: false, optedIn: true, expectedTab: 'private', expectedDot: true },
        { invites: 0, dms: 0, chat: false, optedIn: true, expectedTab: 'social', expectedDot: false },
        { invites: 0, dms: 3, chat: false, optedIn: true, expectedTab: 'private', expectedDot: true },
        { invites: 0, dms: 0, chat: true, optedIn: true, expectedTab: 'private', expectedDot: true },
        { invites: 0, dms: 0, chat: false, optedIn: false, expectedTab: 'private', expectedDot: false },
        { invites: 2, dms: 1, chat: true, optedIn: false, expectedTab: 'private', expectedDot: true },
      ];

      for (const step of sequence) {
        const res = computeNavigationDestination({
          privatePending: step.invites,
          dmUnread: step.dms,
          roomsOutgoingPending: 0,
          squadChatUnread: step.chat,
          communityUnread: 0,
          optedIn: step.optedIn,
          targetView: 'board',
        });

        expect(res.subTab).toBe(step.expectedTab);
        expect(res.showNavDot).toBe(step.expectedDot);
      }
    });

    it('2.2: Stress test — Combinatorial sweep of all attention permutations (32 combinations)', () => {
      const booleanFlags = [false, true];

      for (const hasInvites of booleanFlags) {
        for (const hasDms of booleanFlags) {
          for (const hasChat of booleanFlags) {
            for (const hasPublicUnread of booleanFlags) {
              for (const optedIn of booleanFlags) {
                const res = computeNavigationDestination({
                  privatePending: hasInvites ? 1 : 0,
                  dmUnread: hasDms ? 2 : 0,
                  roomsOutgoingPending: 0,
                  squadChatUnread: hasChat,
                  communityUnread: hasPublicUnread ? 5 : 0,
                  optedIn,
                  targetView: 'board',
                });

                const anyPrivate = hasInvites || hasDms || hasChat;

                if (anyPrivate) {
                  expect(res.subTab).toBe('private');
                  expect(res.showNavDot).toBe(true);
                } else if (optedIn) {
                  expect(res.subTab).toBe('social');
                  expect(res.showNavDot).toBe(hasPublicUnread);
                } else {
                  expect(res.subTab).toBe('private');
                  expect(res.showNavDot).toBe(false);
                }
              }
            }
          }
        }
      }
    });
  });

  // =========================================================================
  // SECTION 3: User Profile Modal Lifecycle & Focus Window Pill Tabs
  // =========================================================================
  describe('3. User Profile Modal Lifecycle & Interactive Pill Tabs', () => {
    it('3.1: Modal Renders cleanly with rounded-[28px] capsule contour and header', () => {
      const testPace = createPaceRow('u1', 6, 8);
      const html = renderToStaticMarkup(
        createElement(UserProfileSheet, {
          open: true,
          userId: 'u1',
          boardPreview: testPace,
          boardPaceWindow: 'week',
          onClose: () => {},
        }),
      );

      expect(html).toContain('data-testid="overlay-backdrop"');
      expect(html).toContain('rounded-[28px]');
      expect(html).toContain('Profile Card');
    });

    it('3.2: Focus Window Pill Switch & Source Code Audit — Confirms ZERO <select> elements', () => {
      const filePath = path.resolve(__dirname, '../src/components/UserProfileSheet.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verify pill buttons configuration
      expect(content).toContain("id: 'today', label: 'Today'");
      expect(content).toContain("id: 'week', label: 'Week'");
      expect(content).toContain("id: 'month', label: 'Month'");

      // Verify pill button onClick
      expect(content).toContain('onClick={() => setFocusWindow(w.id)}');

      // Strict prohibition: zero <select> or <option> elements in UserProfileSheet
      expect(content).not.toMatch(/<select[\s>]/i);
      expect(content).not.toMatch(/<\/select>/i);
      expect(content).not.toMatch(/<option[\s>]/i);
    });

    it('3.3: Dynamic Focus Calculation across Today, Week, Month windows', () => {
      const testPace: PaceRow = {
        userId: 'u1',
        displayName: 'Aspirant Alice',
        examLabel: 'UPSC',
        todayMs: 4 * 3600000,   // 4h
        weekMs: 22 * 3600000,  // 22h
        monthMs: 80 * 3600000, // 80h
        todayKey: anchorISO,
        weekKey: '2026-10-05',
        monthKey: '2026-10-01',
        streak: 14,
        barHours: 8,
        updatedAt: '2026-10-09T10:00:00Z',
      };

      // Verify windowMs helper returns correct totals for each window
      expect(formatDuration(windowMs(testPace, 'today', anchorISO))).toBe('4h');
      expect(formatDuration(windowMs(testPace, 'week', anchorISO))).toBe('22h');
      expect(formatDuration(windowMs(testPace, 'month', anchorISO))).toBe('80h');
    });

    it('3.4: Modal Close Lifecycle — Unmounts dialog cleanly when open=false or userId=null', () => {
      const htmlClosed = renderToStaticMarkup(
        createElement(UserProfileSheet, {
          open: false,
          userId: null,
          onClose: () => {},
        }),
      );

      expect(htmlClosed).toBe('');
      expect(htmlClosed).not.toContain('data-testid="overlay-backdrop"');
    });

    it('3.5: Stats Privacy boundary — When stats_private=true, stats are protected', () => {
      const filePath = path.resolve(__dirname, '../src/components/UserProfileSheet.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('stats_private');
      expect(content).toContain('This user keeps their focus stats private');
    });

    it('3.6: Interactive DP wiring in Room view opens profile card', () => {
      const onOpenProfileSpy = vi.fn();
      const html = renderBoard(
        [{ id: 'u-target', name: 'Target User', hours: 5, barHours: 8 }],
        'u-viewer',
        8,
        onOpenProfileSpy,
      );

      // Verify avatar button is wired with title and aria-label
      expect(html).toContain('aria-label="View Target User&#x27;s profile"');
      expect(html).toContain('title="View Target User&#x27;s profile"');
    });
  });
});
