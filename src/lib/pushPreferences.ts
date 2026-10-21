import { supabase } from './supabase';
import type { NotificationPreferences } from './notifications';

/**
 * Mirrors the Private Hub switches to the server, which decides what to push
 * while the app is closed (supabase/hub_push.sql). Best effort: until that SQL
 * is applied, or while offline, the server keeps its defaults (all on).
 */
export async function syncPushPreferences(userId: string | undefined, prefs: NotificationPreferences): Promise<void> {
  if (!userId) return;
  const hub = prefs.privateHub;
  const row = {
    user_id: userId,
    private_hub: prefs.enabled && hub.enabled,
    direct_messages: hub.directMessages,
    requests: hub.friendRequests || hub.roomInvites,
    room_messages: hub.roomMessages,
    message_previews: hub.messagePreviews !== false,
    updated_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from('push_preferences').upsert({
      ...row,
      board_updates: prefs.enabled && prefs.publicHub.enabled && prefs.publicHub.boardUpdates !== false,
    });
    // Until supabase/board_update_push.sql adds the column, keep syncing the rest.
    if (error?.code === 'PGRST204') await supabase.from('push_preferences').upsert(row);
  } catch {
    /* Retried on the next change or sign-in. */
  }
}
