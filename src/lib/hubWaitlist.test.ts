import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getOrCreateDeviceId,
  isLocallyWaitlisted,
  markLocallyWaitlisted,
  getHubWaitlistStatus,
  joinHubWaitlist,
  submitHubBacker,
} from './hubWaitlist';
import { supabase } from './supabase';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

describe('hubWaitlist library', () => {
  beforeEach(() => {
    const memStore = new MemoryStorage();
    vi.stubGlobal('localStorage', memStore);
    vi.stubGlobal('window', { localStorage: memStore });
    vi.restoreAllMocks();
  });

  it('generates and persists unique device ID in localStorage', () => {
    const id1 = getOrCreateDeviceId();
    expect(id1).toBeTruthy();
    expect(typeof id1).toBe('string');

    const id2 = getOrCreateDeviceId();
    expect(id2).toBe(id1);
  });

  it('correctly tracks local waitlist state', () => {
    expect(isLocallyWaitlisted()).toBe(false);

    markLocallyWaitlisted(true);
    expect(isLocallyWaitlisted()).toBe(true);

    markLocallyWaitlisted(false);
    expect(isLocallyWaitlisted()).toBe(false);
  });

  it('fetches waitlist status via supabase rpc', async () => {
    vi.spyOn(supabase, 'rpc').mockImplementation(
      () =>
        Promise.resolve({
          data: { joined: true, total_count: 42 },
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>
    );

    const status = await getHubWaitlistStatus();
    expect(status.joined).toBe(true);
    expect(status.totalCount).toBe(42);
    expect(isLocallyWaitlisted()).toBe(true);
  });

  it('joins waitlist via supabase rpc and persists locally', async () => {
    vi.spyOn(supabase, 'rpc').mockImplementation(
      () =>
        Promise.resolve({
          data: { joined: true, already_joined: false, total_count: 43 },
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>
    );

    const res = await joinHubWaitlist();
    expect(res.joined).toBe(true);
    expect(res.totalCount).toBe(43);
    expect(isLocallyWaitlisted()).toBe(true);
  });

  it('submits backer details with success response', async () => {
    vi.spyOn(supabase, 'rpc').mockImplementation(
      () =>
        Promise.resolve({
          data: { success: true, id: 'backer-uuid-123' },
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>
    );

    const res = await submitHubBacker({
      amount: 100,
      utr: '123456789012',
      note: 'Cheering for YouDO!',
      username: 'tester',
    });

    expect(res.success).toBe(true);
    expect(res.id).toBe('backer-uuid-123');
  });

  it('handles backer submission errors gracefully', async () => {
    vi.spyOn(supabase, 'rpc').mockImplementation(
      () =>
        Promise.resolve({
          data: null,
          error: { message: 'Invalid UTR format' },
        }) as unknown as ReturnType<typeof supabase.rpc>
    );

    const res = await submitHubBacker({
      amount: 50,
      utr: '',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Invalid UTR format');
  });
});
