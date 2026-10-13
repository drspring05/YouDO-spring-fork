import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const match = vi.fn();
  return {
    rpc: vi.fn(),
    upsert: vi.fn(),
    match,
    from: vi.fn(() => ({ upsert: mocks.upsert, delete: () => ({ match }) })),
  };
});
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));

import { registerPushToken, releasePushToken, setDeviceTokenForTests } from './pushNotifications';

const USER = 'user-1';
const TOKEN = 'fcm-token-1234567890';

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.upsert.mockReset();
  mocks.match.mockReset();
  mocks.from.mockClear();
  setDeviceTokenForTests(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('push token registration', () => {
  it('claims the device for the signed-in account', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(registerPushToken(USER, TOKEN)).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('claim_push_token', { push_token: TOKEN, push_platform: 'android' });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('falls back to a direct upsert only when the server has no claim function yet', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'PGRST202' } });
    mocks.upsert.mockResolvedValue({ error: null });
    await expect(registerPushToken(USER, TOKEN)).resolves.toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER, token: TOKEN }),
      { onConflict: 'user_id,token' },
    );
  });

  it('reports other claim failures without bypassing the server', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '42501' } });
    await expect(registerPushToken(USER, TOKEN)).resolves.toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe('push token release on sign-out', () => {
  it('removes this device from the account', async () => {
    mocks.match.mockResolvedValue({ error: null });
    setDeviceTokenForTests(TOKEN);
    await releasePushToken(USER);
    expect(mocks.match).toHaveBeenCalledWith({ user_id: USER, token: TOKEN });
  });

  it('does nothing without a known device token or account', async () => {
    await releasePushToken(USER);
    setDeviceTokenForTests(TOKEN);
    await releasePushToken(null);
    expect(mocks.match).not.toHaveBeenCalled();
  });

  it('never holds sign-out up for more than a few seconds when offline', async () => {
    vi.useFakeTimers();
    mocks.match.mockReturnValue(new Promise(() => {}));
    setDeviceTokenForTests(TOKEN);
    const release = releasePushToken(USER);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(release).resolves.toBeUndefined();
  });
});
