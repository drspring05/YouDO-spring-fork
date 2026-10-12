import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HubAuthGate from './HubAuthGate';
import PrivateHubUsernameGate from './PrivateHubUsernameGate';
import PrivateHubUnderDevelopment from './PrivateHubUnderDevelopment';
import type { User } from '@supabase/supabase-js';

describe('HubAuthGate', () => {
  it('renders Public Hub gate with community leaderboard highlights', () => {
    const html = renderToStaticMarkup(
      createElement(HubAuthGate, {
        tab: 'social',
        isOffline: false,
        onSwitchTab: vi.fn(),
      }),
    );

    expect(html).toContain('Public Focus Hub · Account Required');
    expect(html).toContain('Join the Global Focus Board');
    expect(html).toContain('Global &amp; Periodic Leaderboards');
    expect(html).toContain('Sign In or Create Account');
    expect(html).toContain('Switch to Private Hub');
    expect(html).toContain('pb-28');
  });

  it('renders Private Hub gate with squad rooms and companion DMs highlights', () => {
    const html = renderToStaticMarkup(
      createElement(HubAuthGate, {
        tab: 'private',
        isOffline: false,
        onSwitchTab: vi.fn(),
      }),
    );

    expect(html).toContain('Private Hub &amp; Rooms · Account Required');
    expect(html).toContain('Unlock Private Study Rooms');
    expect(html).toContain('4-Member Focus Squads');
    expect(html).toContain('Companion DMs &amp; Streaks');
    expect(html).toContain('Sign In or Create Account');
    expect(html).toContain('Switch to Public Board');
  });

  it('renders offline alert notice when offline is detected', () => {
    const html = renderToStaticMarkup(
      createElement(HubAuthGate, {
        tab: 'private',
        isOffline: true,
        onSwitchTab: vi.fn(),
      }),
    );

    expect(html).toContain('You are currently offline');
    expect(html).toContain('Connect to Wi-Fi or mobile data to sign in');
  });
});

describe('PrivateHubUsernameGate', () => {
  const mockUser: User = {
    id: 'user-abc-123',
    app_metadata: {},
    user_metadata: { full_name: 'Test Explorer' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'explorer@example.com',
  } as unknown as User;

  it('renders username setup gate with identity prompt and form inputs', () => {
    const html = renderToStaticMarkup(
      createElement(PrivateHubUsernameGate, {
        user: mockUser,
        initialDraft: 'explorer_study',
        onSuccess: vi.fn(),
        onSwitchToPublic: vi.fn(),
      }),
    );

    expect(html).toContain('Private Hub Entry · Set Identity');
    expect(html).toContain('Choose your @username');
    expect(html).toContain('explorer_study');
    expect(html).toContain('Test Explorer (explorer@example.com)');
    expect(html).toContain('Claim Username &amp; Enter');
    expect(html).toContain('View Public Board');
    expect(html).toContain('pb-28');
  });

  it('falls back to user metadata username when initialDraft is empty', () => {
    const userWithMeta = {
      ...mockUser,
      user_metadata: { full_name: 'Test Explorer', username: 'meta_explorer' },
    } as unknown as User;

    const html = renderToStaticMarkup(
      createElement(PrivateHubUsernameGate, {
        user: userWithMeta,
        initialDraft: '',
        onSuccess: vi.fn(),
        onSwitchToPublic: vi.fn(),
      }),
    );

    expect(html).toContain('meta_explorer');
  });

  it('falls back to localStorage claim when initialDraft and metadata are empty', () => {
    const storageMap = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
      removeItem: (key: string) => { storageMap.delete(key); },
    };
    vi.stubGlobal('localStorage', fakeStorage);
    vi.stubGlobal('window', { localStorage: fakeStorage, location: { search: '' } });

    fakeStorage.setItem('youdo_signup_username:user-abc-123', 'local_stored_handle');

    const html = renderToStaticMarkup(
      createElement(PrivateHubUsernameGate, {
        user: mockUser,
        initialDraft: '',
        onSuccess: vi.fn(),
        onSwitchToPublic: vi.fn(),
      }),
    );

    expect(html).toContain('local_stored_handle');
    vi.unstubAllGlobals();
  });

  it('renders already claimed username confirmation screen when existingProfile has a username', () => {
    const html = renderToStaticMarkup(
      createElement(PrivateHubUsernameGate, {
        user: mockUser,
        existingProfile: {
          id: 'user-abc-123',
          username: 'jatin_focus',
          display_name: 'Jatin',
        },
        onSuccess: vi.fn(),
        onSwitchToPublic: vi.fn(),
      }),
    );

    expect(html).toContain('You have already claimed your username');
    expect(html).toContain('@jatin_focus');
    expect(html).toContain('Continue to Private Hub');
  });
});

describe('HubView unauthenticated scrolling layout', () => {
  it('renders unauthenticated gate in naturally flowing w-full container without trapping overflow', async () => {
    const HubView = (await import('./HubView')).default;
    const html = renderToStaticMarkup(
      createElement(HubView, {
        onOpenBoardSettings: vi.fn(),
        activeTab: 'social',
      }),
    );

    expect(html).toContain('w-full');
    expect(html).toContain('Join the Global Focus Board');
    expect(html).toContain('pb-28');
    expect(html).not.toContain('overflow-y-auto');
    expect(html).not.toContain('h-full');
  }, 15000);

  it('renders PrivateHubUnderDevelopment gate when activeTab is private', async () => {
    const HubView = (await import('./HubView')).default;
    const html = renderToStaticMarkup(
      createElement(HubView, {
        onOpenBoardSettings: vi.fn(),
        activeTab: 'private',
        onSwitchToPublic: vi.fn(),
      }),
    );

    expect(html).toContain('Private Hub is Cooking');
    expect(html).toContain('In The Kitchen · Under Development');
    expect(html).toContain('Back to Public Board');
  }, 15000);
});

describe('PrivateHubUnderDevelopment', () => {
  it('renders cooking notice, roadmap highlights, and action button', () => {
    const html = renderToStaticMarkup(
      createElement(PrivateHubUnderDevelopment, {
        onSwitchToPublic: vi.fn(),
      }),
    );

    expect(html).toContain('Private Hub is Cooking');
    expect(html).toContain('In The Kitchen · Under Development');
    expect(html).toContain('4-Member Focus Squads');
    expect(html).toContain('Companion DMs &amp; Streaks');
    expect(html).toContain('Real-Time Study Sync');
    expect(html).toContain('Back to Public Board');
  });
});

