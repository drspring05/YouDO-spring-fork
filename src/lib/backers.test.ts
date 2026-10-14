import { describe, expect, it, beforeEach, vi } from 'vitest';
import { submitHubBacker } from './backers';
import { supabase } from './supabase';

describe('backer claims', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
