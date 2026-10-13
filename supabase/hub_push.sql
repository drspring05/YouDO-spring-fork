-- Private Hub push notifications, sent while the app is closed.
-- Apply after full_hub_rooms_setup.sql, hub_room_membership.sql and
-- push_dispatch.sql. Rerunnable.
--
-- Policy (only what is addressed to you personally interrupts):
--   push:     direct messages (one notification per chat, updated in place),
--             friend request received, room invite received, join request
--             (to the room's admins), your join request approved, @mention
--             in a room chat.
--   in-app:   everything else (accepted requests, ordinary room messages, ...).
-- Each person's switches live in push_preferences (mirrored from Settings ->
-- Notifications -> Private Hub). No row means the defaults: all on.

create table if not exists public.push_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  private_hub boolean not null default true,
  direct_messages boolean not null default true,
  requests boolean not null default true,
  room_messages text not null default 'all' check (room_messages in ('all', 'mentions', 'off')),
  message_previews boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.push_preferences enable row level security;
grant select, insert, update on table public.push_preferences to authenticated;

drop policy if exists "Own push preferences are readable" on public.push_preferences;
create policy "Own push preferences are readable" on public.push_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Own push preferences are insertable" on public.push_preferences;
create policy "Own push preferences are insertable" on public.push_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Own push preferences are updatable" on public.push_preferences;
create policy "Own push preferences are updatable" on public.push_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Whether a person wants a push of this kind: 'dm', 'request' or 'mention'.
create or replace function private.push_wanted(target uuid, kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.private_hub and case kind
      when 'dm' then p.direct_messages
      when 'request' then p.requests
      when 'mention' then p.room_messages <> 'off'
      else false
    end
    from public.push_preferences p where p.user_id = target
  ), true);
$$;

create or replace function private.push_handle(person uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select nullif(pr.display_name, '') from public.profiles pr where pr.id = person),
    (select '@' || pr.username from public.profiles pr where pr.id = person),
    'Someone'
  );
$$;

revoke all on function private.push_wanted(uuid, text) from public, anon, authenticated;
revoke all on function private.push_handle(uuid) from public, anon, authenticated;

-- 1. Direct messages: one notification per chat (tag), text only if previews are on.
create or replace function private.push_direct_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare show_text boolean;
begin
  if new.sender_id = new.receiver_id or not private.push_wanted(new.receiver_id, 'dm') then return null; end if;
  select coalesce((select p.message_previews from public.push_preferences p where p.user_id = new.receiver_id), true)
    into show_text;
  perform private.dispatch_push(
    array[new.receiver_id],
    private.push_handle(new.sender_id),
    case when show_text then pg_catalog.left(new.content, 140) else 'New message' end,
    pg_catalog.jsonb_build_object('type', 'dm', 'from', new.sender_id, 'tag', 'dm-' || new.sender_id, 'channel', 'private-hub')
  );
  return null;
end; $$;

-- 2. Friend requests: the receiver, once, when the request is sent.
create or replace function private.push_friend_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'pending' or not private.push_wanted(new.receiver_id, 'request') then return null; end if;
  perform private.dispatch_push(
    array[new.receiver_id],
    'Friend request',
    private.push_handle(new.requester_id) || ' wants to add you as a friend.',
    pg_catalog.jsonb_build_object('type', 'friend_request', 'from', new.requester_id, 'channel', 'private-hub')
  );
  return null;
end; $$;

-- 3. Rooms: invites, join requests (to admins) and approvals.
create or replace function private.push_room_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare room_name text;
declare admins uuid[];
begin
  select s.name into room_name from public.squads s where s.id = new.squad_id;
  room_name := coalesce(room_name, 'a room');

  if tg_op = 'INSERT' and new.status = 'invited' then
    if private.push_wanted(new.user_id, 'request') then
      perform private.dispatch_push(
        array[new.user_id], 'Room invite', 'You are invited to join ' || room_name || '.',
        pg_catalog.jsonb_build_object('type', 'room_invite', 'squad', new.squad_id, 'channel', 'private-hub')
      );
    end if;
  elsif tg_op = 'INSERT' and new.status = 'pending' then
    select pg_catalog.array_agg(m.user_id) into admins
    from public.squad_members m
    where m.squad_id = new.squad_id and m.role = 'admin' and m.status = 'accepted'
      and m.user_id <> new.user_id and private.push_wanted(m.user_id, 'request');
    perform private.dispatch_push(
      admins, 'Join request', private.push_handle(new.user_id) || ' asked to join ' || room_name || '.',
      pg_catalog.jsonb_build_object('type', 'room_request', 'squad', new.squad_id, 'channel', 'private-hub')
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    if private.push_wanted(new.user_id, 'request') then
      perform private.dispatch_push(
        array[new.user_id], 'You''re in', room_name || ' accepted your request to join.',
        pg_catalog.jsonb_build_object('type', 'room', 'squad', new.squad_id, 'channel', 'private-hub')
      );
    end if;
  end if;
  return null;
end; $$;

-- 4. Room chat: only people @mentioned by username (ordinary messages stay in-app).
create or replace function private.push_room_mention()
returns trigger language plpgsql security definer set search_path = '' as $$
declare room_name text;
declare mentioned uuid[];
begin
  if pg_catalog.strpos(new.content, '@') = 0 then return null; end if;
  select pg_catalog.array_agg(m.user_id) into mentioned
  from public.squad_members m
  join public.profiles p on p.id = m.user_id
  where m.squad_id = new.squad_id and m.status = 'accepted' and m.user_id <> new.sender_id
    and new.content ~* ('(^|[^a-z0-9_])@'
      || pg_catalog.regexp_replace(p.username, '([^a-zA-Z0-9_])', '\\\1', 'g')
      || '([^a-z0-9_]|$)')
    and private.push_wanted(m.user_id, 'mention');
  if mentioned is null then return null; end if;
  select s.name into room_name from public.squads s where s.id = new.squad_id;
  perform private.dispatch_push(
    mentioned,
    private.push_handle(new.sender_id) || ' in ' || coalesce(room_name, 'your room'),
    pg_catalog.left(new.content, 140),
    pg_catalog.jsonb_build_object('type', 'room', 'squad', new.squad_id, 'tag', 'room-' || new.squad_id, 'channel', 'private-hub')
  );
  return null;
end; $$;

revoke all on function private.push_direct_message() from public, anon, authenticated;
revoke all on function private.push_friend_request() from public, anon, authenticated;
revoke all on function private.push_room_membership() from public, anon, authenticated;
revoke all on function private.push_room_mention() from public, anon, authenticated;

drop trigger if exists trg_push_direct_message on public.direct_messages;
create trigger trg_push_direct_message after insert on public.direct_messages
  for each row execute function private.push_direct_message();

drop trigger if exists trg_push_friend_request on public.friendships;
create trigger trg_push_friend_request after insert on public.friendships
  for each row execute function private.push_friend_request();

drop trigger if exists trg_push_room_membership on public.squad_members;
create trigger trg_push_room_membership after insert or update of status on public.squad_members
  for each row execute function private.push_room_membership();

drop trigger if exists trg_push_room_mention on public.squad_messages;
create trigger trg_push_room_mention after insert on public.squad_messages
  for each row execute function private.push_room_mention();
