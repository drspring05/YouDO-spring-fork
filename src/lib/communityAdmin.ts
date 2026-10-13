import { supabase } from './supabase';

/** Whether the signed-in account administers YouDO. Fails closed on any error. */
export async function fetchIsCommunityAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_community_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}
