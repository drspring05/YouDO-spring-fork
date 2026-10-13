import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useUiPrefs', () => ({
  useUiPrefs: () => [{ liquidGlass: false, legacyStyle: false, roomyHeader: false }],
}));

import CommandBar from './CommandBar';

const base = { view: 'tasks' as const, onNavigate: vi.fn(), onSettings: vi.fn() };

describe('Settings button and the Admin Hub', () => {
  it('stays a plain Settings button for members', () => {
    const html = renderToStaticMarkup(createElement(CommandBar, { ...base, adminPending: 4 }));
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('title="Settings"');
    expect(html).not.toContain('admin-orb-badge');
  });

  it('shows admins how many items wait, as a number apart from the sync dot', () => {
    const html = renderToStaticMarkup(
      createElement(CommandBar, { ...base, onOpenAdminHub: vi.fn(), adminPending: 3, syncAttention: true }),
    );
    expect(html).toContain('Settings, 3 admin items waiting');
    expect(html).toContain('title="Settings · hold for Admin Hub"');
    expect(html).toContain('admin-orb-badge');
    expect(html).toContain('>3<');
    expect(html).toContain('Sync needs review');
  });

  it('caps the badge and hides it when the queue is empty', () => {
    const busy = renderToStaticMarkup(createElement(CommandBar, { ...base, onOpenAdminHub: vi.fn(), adminPending: 12 }));
    expect(busy).toContain('>9+<');
    const clear = renderToStaticMarkup(createElement(CommandBar, { ...base, onOpenAdminHub: vi.fn(), adminPending: 0 }));
    expect(clear).not.toContain('admin-orb-badge');
    expect(clear).toContain('aria-label="Settings"');
  });

  it('leaves the Hub tab alone: no admin marker there', () => {
    const html = renderToStaticMarkup(
      createElement(CommandBar, { ...base, view: 'board', onOpenAdminHub: vi.fn(), adminPending: 5, hubSubTab: 'social' }),
    );
    const hubTab = html.slice(html.indexOf('Public'), html.indexOf('tab-bar-orb'));
    expect(hubTab).not.toContain('admin');
  });
});
