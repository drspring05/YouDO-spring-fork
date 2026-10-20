import { supabase } from './supabase';
import { STORAGE_KEYS } from './storageKeys';
import { fetchMySquads } from './squads';

export interface SquadMessage {
  id: string;
  squad_id: string;
  sender_id: string;
  content: string;
  reply_to_id?: string | null;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  reply_to_id?: string | null;
  read_at?: string | null;
  created_at: string;
  /** A shared goal tree (see goalShare.ts); read it with parseGoalShare. */
  goal_share?: unknown;
}

// -- SQUAD MESSAGES --

export async function fetchSquadMessages(squadId: string): Promise<SquadMessage[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('squad_messages')
    .select('*')
    .eq('squad_id', squadId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('fetchSquadMessages error:', error);
    return [];
  }
  return data as SquadMessage[];
}

export async function sendSquadMessage(squadId: string, senderId: string, content: string, replyToId?: string | null) {
  const { error } = await supabase
    .from('squad_messages')
    .insert({
      squad_id: squadId,
      sender_id: senderId,
      content,
      reply_to_id: replyToId || null
    });

  if (error) {
    console.error('sendSquadMessage error:', error);
    return false;
  }
  return true;
}

export async function deleteSquadMessage(messageId: string, senderId: string) {
  const { error } = await supabase
    .from('squad_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', senderId);
  return !error;
}

function squadChatReadStorageKey(userId: string) {
  return `${STORAGE_KEYS.squadChatRead}:${userId}`;
}

export function loadSquadChatReadMap(userId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(squadChatReadStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markSquadChatRead(userId: string, squadId: string, readAtIso?: string) {
  const map = loadSquadChatReadMap(userId);
  map[squadId] = readAtIso ?? new Date().toISOString();
  try {
    localStorage.setItem(squadChatReadStorageKey(userId), JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

/** Unread chat messages from others per room since you last read it (24h window). */
export async function fetchSquadUnreadCounts(userId: string, squadIds: string[]): Promise<Record<string, number>> {
  if (squadIds.length === 0) return {};
  const readMap = loadSquadChatReadMap(userId);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('squad_messages')
    .select('squad_id, created_at, sender_id')
    .in('squad_id', squadIds)
    .neq('sender_id', userId)
    .gte('created_at', cutoff);

  if (error) {
    console.error('fetchSquadUnreadCounts error:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const lastRead = readMap[row.squad_id];
    if (!lastRead || row.created_at > lastRead) counts[row.squad_id] = (counts[row.squad_id] ?? 0) + 1;
  }
  return counts;
}

/** True if any joined squad has chat messages from others since last read (24h window). */
export async function squadRoomsHaveUnreadChat(userId: string): Promise<boolean> {
  const squads = await fetchMySquads(userId);
  const counts = await fetchSquadUnreadCounts(userId, squads.map((s) => s.id));
  return Object.keys(counts).length > 0;
}

// -- DIRECT MESSAGES --

const dmCutoffIso = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export interface DmInboxPreview {
  lastMessage: string;
  lastAt: string;
  fromMe: boolean;
  unreadCount: number;
}

export async function fetchDmInboxPreviews(userId: string): Promise<Record<string, DmInboxPreview>> {
  const cutoff = dmCutoffIso();
  const { data, error } = await supabase
    .from('direct_messages')
    .select('sender_id, receiver_id, content, created_at, read_at')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error || !data) {
    if (error) console.error('fetchDmInboxPreviews error:', error);
    return {};
  }

  const previews: Record<string, DmInboxPreview> = {};
  const unread: Record<string, number> = {};

  for (const row of data) {
    const friendId = row.sender_id === userId ? row.receiver_id : row.sender_id;
    if (row.receiver_id === userId && !row.read_at) {
      unread[friendId] = (unread[friendId] ?? 0) + 1;
    }
    if (!previews[friendId]) {
      previews[friendId] = {
        lastMessage: row.content,
        lastAt: row.created_at,
        fromMe: row.sender_id === userId,
        unreadCount: 0,
      };
    }
  }

  for (const friendId of Object.keys(previews)) {
    previews[friendId].unreadCount = unread[friendId] ?? 0;
  }

  return previews;
}

export async function markDirectConversationRead(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', userId)
    .eq('sender_id', friendId)
    .is('read_at', null);
  if (error) console.error('markDirectConversationRead error:', error);
}

export async function fetchDirectMessages(userId: string, friendId: string): Promise<DirectMessage[]> {
  const cutoff = dmCutoffIso();
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('fetchDirectMessages error:', error);
    return [];
  }
  return data as DirectMessage[];
}

export async function sendDirectMessage(
  senderId: string,
  receiverId: string,
  content: string,
  replyToId?: string | null,
  goalShare?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('direct_messages').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    content,
    reply_to_id: replyToId || null,
    ...(goalShare ? { goal_share: goalShare } : {}),
  });

  if (error) {
    console.error('sendDirectMessage error:', error);
    // The goal_share column comes with supabase/dm_goal_share.sql.
    if (goalShare && /goal_share/i.test(error.message)) {
      return { ok: false, error: 'Goal sharing needs the latest server update.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteDirectMessage(messageId: string, senderId: string) {
  const { error } = await supabase
    .from('direct_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', senderId);
  return !error;
}
