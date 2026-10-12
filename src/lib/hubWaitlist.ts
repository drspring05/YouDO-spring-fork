import { supabase } from './supabase';

const DEVICE_ID_KEY = 'youdo_anon_device_id';
const LOCAL_WAITLIST_KEY = 'youdo_hub_waitlist_joined';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'dev_' + Math.random().toString(36).slice(2) + Date.now();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'fallback_device';
  }
}

export function isLocallyWaitlisted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LOCAL_WAITLIST_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markLocallyWaitlisted(joined = true): void {
  if (typeof window === 'undefined') return;
  try {
    if (joined) {
      localStorage.setItem(LOCAL_WAITLIST_KEY, 'true');
    } else {
      localStorage.removeItem(LOCAL_WAITLIST_KEY);
    }
  } catch {
    /* ignore */
  }
}

export interface WaitlistStatus {
  joined: boolean;
  totalCount: number;
}

export async function getHubWaitlistStatus(): Promise<WaitlistStatus> {
  const deviceId = getOrCreateDeviceId();
  try {
    const { data, error } = await supabase.rpc('get_hub_waitlist_status', {
      p_device_id: deviceId,
    });
    if (error) {
      console.warn('Failed to fetch waitlist status:', error.message);
      return { joined: isLocallyWaitlisted(), totalCount: 0 };
    }

    const payload = data as { joined?: boolean; total_count?: number } | null;
    const joined = Boolean(payload?.joined || isLocallyWaitlisted());
    if (joined) markLocallyWaitlisted(true);

    return {
      joined,
      totalCount: Math.max(0, Number(payload?.total_count ?? 0)),
    };
  } catch (err) {
    console.warn('Waitlist status check failed:', err);
    return { joined: isLocallyWaitlisted(), totalCount: 0 };
  }
}

export interface JoinWaitlistResult {
  joined: boolean;
  totalCount: number;
  alreadyJoined: boolean;
}

export async function joinHubWaitlist(): Promise<JoinWaitlistResult> {
  const deviceId = getOrCreateDeviceId();
  try {
    const { data, error } = await supabase.rpc('join_hub_waitlist', {
      p_device_id: deviceId,
    });
    if (error) {
      console.warn('Failed to join waitlist:', error.message);
      markLocallyWaitlisted(true);
      return { joined: true, totalCount: 1, alreadyJoined: false };
    }

    const payload = data as {
      joined?: boolean;
      already_joined?: boolean;
      total_count?: number;
    } | null;

    markLocallyWaitlisted(true);

    return {
      joined: true,
      alreadyJoined: Boolean(payload?.already_joined),
      totalCount: Math.max(1, Number(payload?.total_count ?? 1)),
    };
  } catch (err) {
    console.warn('Failed to join waitlist:', err);
    markLocallyWaitlisted(true);
    return { joined: true, totalCount: 1, alreadyJoined: false };
  }
}

export interface SubmitBackerParams {
  amount: number;
  utr: string;
  note?: string;
  username?: string;
}

export interface SubmitBackerResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function submitHubBacker({
  amount,
  utr,
  note,
  username,
}: SubmitBackerParams): Promise<SubmitBackerResult> {
  try {
    const { data, error } = await supabase.rpc('submit_hub_backer', {
      p_amount: amount,
      p_utr: utr.trim(),
      p_note: note?.trim() || null,
      p_username: username?.trim() || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as { success?: boolean; id?: string; error?: string } | null;
    if (res?.success) {
      return { success: true, id: res.id };
    }
    return { success: false, error: res?.error || 'Submission failed' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: message };
  }
}

export interface PendingBackerItem {
  id: string;
  user_id?: string | null;
  username: string;
  amount: number;
  currency: string;
  utr: string;
  note?: string | null;
  status: string;
  created_at: string;
}

export async function fetchPendingHubBackers(): Promise<PendingBackerItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_pending_hub_backers');
    if (error || !Array.isArray(data)) {
      return [];
    }
    return data as PendingBackerItem[];
  } catch {
    return [];
  }
}

export async function reviewHubBacker(
  backerId: string,
  status: 'verified' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('review_hub_backer', {
      p_backer_id: backerId,
      p_status: status,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    const res = data as { success?: boolean; error?: string } | null;
    return { success: Boolean(res?.success), error: res?.error };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: message };
  }
}

