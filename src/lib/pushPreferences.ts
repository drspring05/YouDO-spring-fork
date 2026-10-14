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
  try {
    await supabase.from('push_preferences').upsert({
      user_id: userId,
      private_hub: prefs.enabled && hub.enabled,
      direct_messages: hub.directMessages,
      requests: hub.friendRequests || hub.roomInvites,
      room_messages: hub.roomMessages,
      message_previews: hub.messagePreviews !== false,
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* Retried on the next change or sign-in. */
  }
}
