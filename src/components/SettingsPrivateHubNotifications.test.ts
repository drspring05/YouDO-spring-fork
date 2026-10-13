import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./SettingsSheet.tsx', import.meta.url), 'utf8');

describe('Settings → Notifications → Private Hub', () => {
  it('is a working card, not the old under-development lock', () => {
    expect(source).not.toMatch(/under development/i);
    expect(source).not.toContain('(Locked)');
  });

  it('edits the real private hub preferences', () => {
    expect(source).toContain('privateHub: { ...p.privateHub, enabled: !p.privateHub.enabled }');
    expect(source).toContain('privateHub: { ...p.privateHub, directMessages: !p.privateHub.directMessages }');
    expect(source).toContain('friendRequests: next, roomInvites: next');
    expect(source).toContain('privateHub: { ...p.privateHub, roomMessages: mode }');
  });
});
