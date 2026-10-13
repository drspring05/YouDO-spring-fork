import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }));

import {
  CLOSED_PRIVATE_HUB,
  PRIVATE_HUB_ACCESS_EVENT,
  canOpenPrivateHub,
  fetchPrivateHubAccess,
  parsePrivateHubAccess,
  setPrivateHubEnabled,
} from './privateHubAccess';

beforeEach(() => mocks.rpc.mockReset());

describe('Private Hub switch', () => {
  it('lets members in only when it is on, and admins always', () => {
    expect(canOpenPrivateHub({ enabled: false, isAdmin: false })).toBe(false);
    expect(canOpenPrivateHub({ enabled: true, isAdmin: false })).toBe(true);
    expect(canOpenPrivateHub({ enabled: false, isAdmin: true })).toBe(true);
  });

  it('treats anything but an explicit true as closed', () => {
    expect(parsePrivateHubAccess(null)).toEqual(CLOSED_PRIVATE_HUB);
    expect(parsePrivateHubAccess({ enabled: 'true', isAdmin: 1 })).toEqual(CLOSED_PRIVATE_HUB);
    expect(parsePrivateHubAccess({ enabled: true, isAdmin: false })).toEqual({ enabled: true, isAdmin: false });
  });

  it('reads the server switch', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { enabled: true, isAdmin: false }, error: null });
    await expect(fetchPrivateHubAccess()).resolves.toEqual({ enabled: true, isAdmin: false });
    expect(mocks.rpc).toHaveBeenCalledWith('private_hub_access');
  });

  it('fails closed on errors and offline', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'down' } });
    await expect(fetchPrivateHubAccess()).resolves.toEqual(CLOSED_PRIVATE_HUB);
    mocks.rpc.mockRejectedValueOnce(new Error('offline'));
    await expect(fetchPrivateHubAccess()).resolves.toEqual(CLOSED_PRIVATE_HUB);
  });

  it('still recognises admins on a server without the switch, keeping the hub closed to members', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } })
      .mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchPrivateHubAccess()).resolves.toEqual({ enabled: false, isAdmin: true });
    expect(mocks.rpc).toHaveBeenLastCalledWith('is_community_admin');
  });

  it('announces a change so every view updates at once', async () => {
    const heard = vi.fn();
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    target.addEventListener(PRIVATE_HUB_ACCESS_EVENT, (event) => heard((event as CustomEvent).detail));
    mocks.rpc.mockResolvedValueOnce({ data: { enabled: true, isAdmin: true }, error: null });
    await expect(setPrivateHubEnabled(true)).resolves.toEqual({ enabled: true, isAdmin: true });
    expect(mocks.rpc).toHaveBeenCalledWith('set_private_hub_enabled', { next_enabled: true });
    expect(heard).toHaveBeenCalledWith({ enabled: true, isAdmin: true });
    vi.unstubAllGlobals();
  });

  it('reports a refused change instead of pretending it worked', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Admin required' } });
    await expect(setPrivateHubEnabled(true)).rejects.toThrow('Admin required');
  });
});
