import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import BoardView from './BoardView';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user-1' } }),
}));

vi.mock('../store', () => ({
  useStore: () => ({
    publishPublicPace: vi.fn().mockResolvedValue({ ok: true }),
    syncToCloud: vi.fn().mockResolvedValue({ ok: true }),
    pacePrefs: { optedIn: true },
  }),
}));

vi.mock('../lib/community', () => ({
  fetchCommunityContext: vi.fn().mockResolvedValue({
    available: true,
    dayKey: '2026-10-10',
    isAdmin: false,
    canJoin: true,
    canPost: true,
    settings: { roomEnabled: true, appreciationsEnabled: true, announcement: '' },
    staffIds: [],
    banned: false,
  }),
  fetchAdminHubCounts: vi.fn().mockResolvedValue({
    reports: 0,
    appeals: 0,
    hashtagRequests: 0,
    chatReplies: 0,
    total: 0,
  }),
  fetchAppreciations: vi.fn().mockResolvedValue({ counts: {}, mine: new Set() }),
  giveKudos: vi.fn(),
}));

vi.mock('../lib/paceCloud', () => ({
  fetchPaceRows: vi.fn().mockResolvedValue({ ok: true, rows: [] }),
}));

vi.mock('../lib/boardRefresh', () => ({
  refreshBoard: vi.fn(),
}));

describe('BoardView responsive layout & hygiene', () => {
  it('renders board workspace with overflow-x-hidden to prevent horizontal scrolling', () => {
    const html = renderToStaticMarkup(
      createElement(BoardView, {
        onOpenBoardSettings: vi.fn(),
      }),
    );

    expect(html).toContain('board-workspace pb-4 overflow-x-hidden');
    expect(html).not.toContain('Focus sync details');
  });

  it('never outputs redundant Focus sync details element', () => {
    const html = renderToStaticMarkup(
      createElement(BoardView, {
        onOpenBoardSettings: vi.fn(),
      }),
    );

    expect(html).not.toContain('Focus sync details');
    expect(html).not.toContain('sittings were excluded');
    expect(html).not.toContain('sitting was excluded');
  });

  it('keeps admin tools off the Board: the Admin Hub opens from the Settings button', () => {
    const html = renderToStaticMarkup(
      createElement(BoardView, {
        onOpenBoardSettings: vi.fn(),
        initialCommunity: {
          available: true,
          dayKey: '2026-10-10',
          isAdmin: true,
          canJoin: true,
          canPost: true,
          settings: { roomEnabled: true, appreciationsEnabled: true, announcement: '' },
          staffIds: [],
          banned: false,
        },
      }),
    );

    expect(html).toContain('board-community-link');
    expect(html).not.toContain('board-admin-link');
    expect(html).not.toContain('board-admin-badge');
    expect(html).not.toContain('with-admin');
  });

  it('safely passes onOpenProfile callback which supports null row for off-board chat authors', () => {
    const onOpenProfile = vi.fn();
    const html = renderToStaticMarkup(
      createElement(BoardView, {
        onOpenBoardSettings: vi.fn(),
        onOpenProfile,
      }),
    );
    expect(html).toContain('board-workspace');
    expect(typeof onOpenProfile).toBe('function');
  });

  it('renders community unread count pill cleanly without pulse dot or extra text for visual uniformity', () => {
    const html = renderToStaticMarkup(
      createElement(BoardView, {
        onOpenBoardSettings: vi.fn(),
        initialCommunity: {
          available: true,
          dayKey: '2026-10-10',
          isAdmin: false,
          canJoin: true,
          canPost: true,
          settings: { roomEnabled: true, appreciationsEnabled: true, announcement: '' },
          staffIds: [],
          banned: false,
          unread: { chat: 4, updates: 0 },
        },
      }),
    );

    expect(html).toContain('board-community-link has-unread');
    expect(html).toContain('board-unread-pill');
    expect(html).toContain('>4<');
    expect(html).not.toContain('board-unread-pulse');
    expect(html).not.toContain('board-unread-text');
  });
});

