import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), sync: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('./privateHubSync', () => ({ dispatchPrivateHubSync: mocks.sync }));

import { acceptSquadInvite, acceptSquadJoinRequest } from './squads';

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.sync.mockReset();
});

describe('accepting room invites and join requests', () => {
  it('accepts an invite through the server function for the signed-in member', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(acceptSquadInvite('room-1')).resolves.toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('accept_squad_invite', { target_squad: 'room-1' });
    expect(mocks.sync).toHaveBeenCalledWith('squads');
    expect(mocks.sync).toHaveBeenCalledWith('pending');
  });

  it('approves a join request through the admin-only server function', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(acceptSquadJoinRequest('room-1', 'user-2')).resolves.toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('approve_squad_join_request', { target_squad: 'room-1', requester: 'user-2' });
  });

  it('passes on why the server refused, so the button never silently does nothing', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'This room is full' } });
    await expect(acceptSquadInvite('room-1')).resolves.toEqual({ ok: false, error: 'This room is full' });
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('reports a connection failure instead of throwing', async () => {
    mocks.rpc.mockRejectedValue(new Error('offline'));
    const result = await acceptSquadJoinRequest('room-1', 'user-2');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Could not approve/);
  });
});
