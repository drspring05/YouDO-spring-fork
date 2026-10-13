import { supabase } from './supabase';

/** Whether members can open the Private Hub, and whether this account administers it. */
export interface PrivateHubAccess {
  enabled: boolean;
  isAdmin: boolean;
}

export const CLOSED_PRIVATE_HUB: PrivateHubAccess = { enabled: false, isAdmin: false };

/** Fired after an admin changes the switch, so every view re-reads it. */
export const PRIVATE_HUB_ACCESS_EVENT = 'youdo-private-hub-access';

/** Admins can always open the hub, so it can be tested before launch. */
export function canOpenPrivateHub(access: PrivateHubAccess): boolean {
  return access.enabled || access.isAdmin;
}

export function parsePrivateHubAccess(data: unknown): PrivateHubAccess {
  if (!data || typeof data !== 'object') return CLOSED_PRIVATE_HUB;
  const row = data as Record<string, unknown>;
  return { enabled: row.enabled === true, isAdmin: row.isAdmin === true };
}

/**
 * Fails closed: any error keeps the hub shut. A server without
 * private_hub_access.sql still recognises admins, so the Admin Hub stays reachable.
 */
export async function fetchPrivateHubAccess(): Promise<PrivateHubAccess> {
  try {
    const { data, error } = await supabase.rpc('private_hub_access');
    if (!error) return parsePrivateHubAccess(data);
    if (error.code !== 'PGRST202') return CLOSED_PRIVATE_HUB;
    const admin = await supabase.rpc('is_community_admin');
    return { enabled: false, isAdmin: !admin.error && admin.data === true };
  } catch {
    return CLOSED_PRIVATE_HUB;
  }
}

export async function setPrivateHubEnabled(next: boolean): Promise<PrivateHubAccess> {
  const { data, error } = await supabase.rpc('set_private_hub_enabled', { next_enabled: next });
  if (error) throw new Error(error.message || 'Could not change the Private Hub switch.');
  const access = parsePrivateHubAccess(data);
  window.dispatchEvent(new CustomEvent(PRIVATE_HUB_ACCESS_EVENT, { detail: access }));
  return access;
}
