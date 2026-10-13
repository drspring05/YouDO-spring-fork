import { supabase } from './supabase';
import { paceWindowKeys, type PaceRow } from './paceBoard';
import { todayISO } from './dates';
import { viewerBoardTimezone } from './paceCloud';

/**
 * Rebuild your room copy of focus from your latest cloud backup. Rooms count
 * focus whether or not you joined the Public Board. A no-op on the server for
 * people without a room, and for a backup it already processed.
 */
export async function reconcileRoomEvidence(): Promise<{ ok: boolean; status?: string }> {
  try {
    const { data, error } = await supabase.rpc('reconcile_room_evidence');
    if (error) return { ok: false };
    const result = Array.isArray(data) ? data[0] : data;
    return { ok: true, status: typeof result?.status === 'string' ? result.status : undefined };
  } catch {
    return { ok: false };
  }
}

/**
 * A room's members' focus as Board-shaped rows, keyed by user id. Members who
 * have never synced are left out, so the board shows them as not shared yet.
 * Returns null on a server without hub_room_focus.sql (use the Board instead).
 */
export async function fetchRoomPaceRows(
  squadId: string,
  names: Record<string, string> = {},
  boardTimezone = viewerBoardTimezone(),
): Promise<Record<string, PaceRow> | null> {
  const { data, error } = await supabase.rpc('room_pace_rows', { target_squad: squadId, board_timezone: boardTimezone });
  if (error?.code === 'PGRST202') return null;
  if (error || !Array.isArray(data)) return {};
  const keys = paceWindowKeys(todayISO());
  const out: Record<string, PaceRow> = {};
  for (const raw of data as Record<string, unknown>[]) {
    if (typeof raw.user_id !== 'string' || typeof raw.synced_at !== 'string') continue;
    out[raw.user_id] = {
      userId: raw.user_id,
      displayName: names[raw.user_id] ?? '',
      examLabel: '',
      todayMs: Number(raw.today_ms) || 0,
      weekMs: Number(raw.week_ms) || 0,
      monthMs: Number(raw.month_ms) || 0,
      ...keys,
      streak: 0,
      barHours: Number(raw.bar_hours) || 0,
      updatedAt: raw.synced_at,
    };
  }
  return out;
}
