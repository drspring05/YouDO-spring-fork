-- ==============================================================================
-- YouDO — Private Hub room focus (independent of the Public Board)
-- ==============================================================================
-- Room progress uses the same evidence as the Public Board — focus sessions in
-- each member's synced cloud backup — but through its own tables, so people
-- who stay off the Public Board still count in their rooms, and the Board's
-- pipeline is untouched. Only accepted room-mates can read the totals; leaving
-- your last room deletes your room copy.
--
-- Apply after user_backups.sql, cloud_backup_revisions.sql and
-- full_hub_rooms_setup.sql. Rerunnable.
-- ==============================================================================

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.room_focus_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  start_ms bigint not null,
  end_ms bigint not null,
  net_ms bigint not null,
  pauses jsonb not null default '[]'::jsonb,
  ledger_complete boolean not null default false,
  primary key (user_id, session_id),
  constraint room_focus_session_bounds check (
    start_ms < end_ms and net_ms >= 15000 and net_ms <= end_ms - start_ms
    and end_ms - start_ms <= 604800000
  )
);
create index if not exists room_focus_sessions_user_start on public.room_focus_sessions (user_id, start_ms);
alter table public.room_focus_sessions enable row level security;
revoke all on public.room_focus_sessions from public, anon, authenticated;

create table if not exists public.room_focus_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  backup_revision bigint not null,
  bar_hours numeric,
  accepted integer not null,
  rejected integer not null,
  reconciled_at timestamptz not null default clock_timestamp()
);
alter table public.room_focus_state enable row level security;
revoke all on public.room_focus_state from public, anon, authenticated;

-- Rebuild the caller's room copy from their current backup. The same checks as
-- the Board's reconcile_board_evidence; only the last 40 days are kept, enough
-- for Today / Week / Month.
create or replace function public.reconcile_room_evidence()
returns table(status text, accepted integer, rejected integer, backup_revision bigint)
language plpgsql security definer set search_path = '' as $function$
declare
  owner_id uuid := auth.uid();
  backup_text text;
  rev bigint;
  payload jsonb;
  history jsonb;
  item jsonb;
  sid text;
  start_value bigint;
  end_value bigint;
  net_value bigint;
  elapsed bigint;
  pause_item jsonb;
  pause_start bigint;
  pause_end bigint;
  pause_until bigint;
  documented_pause bigint;
  complete_ledger boolean;
  prior_end bigint := 0;
  good integer := 0;
  bad integer := 0;
  row_count integer;
  bar numeric;
  oldest bigint := (extract(epoch from clock_timestamp() - interval '40 days') * 1000)::bigint;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.squad_members m where m.user_id = owner_id and m.status = 'accepted') then
    return query select 'not_in_room'::text, 0, 0, null::bigint; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 890));
  select b.backup_data, b.revision into backup_text, rev from public.user_backups b where b.user_id = owner_id for share;
  if rev is null then return query select 'waiting_for_sync'::text, 0, 0, null::bigint; return; end if;
  if pg_catalog.octet_length(backup_text) > 4194304 then return query select 'too_large'::text, 0, 0, rev; return; end if;
  if exists (select 1 from public.room_focus_state s where s.user_id = owner_id and s.backup_revision = rev) then
    return query select 'current'::text, s.accepted, s.rejected, rev from public.room_focus_state s where s.user_id = owner_id; return;
  end if;
  begin
    payload := backup_text::jsonb;
  exception when others then
    return query select 'invalid_backup'::text, 0, 0, rev; return;
  end;
  history := coalesce(payload -> 'sessionHistory', '{}'::jsonb);
  if pg_catalog.jsonb_typeof(history) <> 'object' then return query select 'invalid_backup'::text, 0, 0, rev; return; end if;
  select count(*) into row_count from pg_catalog.jsonb_each(history) h,
    lateral pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(h.value) = 'array' then h.value else '[]'::jsonb end) s;
  if row_count > 5000 then return query select 'too_many_sessions'::text, 0, row_count, rev; return; end if;

  begin
    bar := (payload -> 'streakMeta' ->> 'barHours')::numeric;
    if bar is not null and (bar < 0.5 or bar > 16) then bar := null; end if;
  exception when others then
    bar := null;
  end;

  delete from public.room_focus_sessions f where f.user_id = owner_id;
  for item in
    select s.value from pg_catalog.jsonb_each(history) h,
      lateral pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(h.value) = 'array' then h.value else '[]'::jsonb end) s
    order by case when s.value->>'startTime' ~ '^[0-9]{12,13}$' then (s.value->>'startTime')::numeric else null end nulls last
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
      or coalesce(item->>'manual', 'false') = 'true'
      or coalesce(item->>'id', '') = ''
      or pg_catalog.length(item->>'id') > 200
      or coalesce(item->>'startTime', '') !~ '^[0-9]{12,13}$'
      or coalesce(item->>'endTime', '') !~ '^[0-9]{12,13}$'
      or coalesce(item->>'netFocusMs', '') !~ '^[0-9]{1,9}$' then
      bad := bad + 1; continue;
    end if;
    sid := item->>'id';
    start_value := (item->>'startTime')::bigint;
    end_value := (item->>'endTime')::bigint;
    net_value := (item->>'netFocusMs')::bigint;
    elapsed := end_value - start_value;
    if end_value < oldest then continue; end if;
    if end_value > (extract(epoch from clock_timestamp() + interval '5 minutes') * 1000)::bigint
      or elapsed <= 0 or elapsed > 604800000 or net_value < 15000 or net_value > elapsed
      or start_value < prior_end
      or exists (select 1 from public.room_focus_sessions f where f.user_id = owner_id and f.session_id = sid) then
      bad := bad + 1; continue;
    end if;

    complete_ledger := true;
    documented_pause := 0;
    pause_until := start_value;
    if pg_catalog.jsonb_typeof(item->'pauses') = 'array' then
      for pause_item in select value from pg_catalog.jsonb_array_elements(item->'pauses') loop
        if coalesce(pause_item->>'start', '') !~ '^[0-9]{12,13}$' or coalesce(pause_item->>'end', '') !~ '^[0-9]{12,13}$' then
          complete_ledger := false; exit;
        end if;
        pause_start := (pause_item->>'start')::bigint;
        pause_end := (pause_item->>'end')::bigint;
        if pause_start < pause_until or pause_end > end_value or pause_end <= pause_start then
          complete_ledger := false; exit;
        end if;
        documented_pause := documented_pause + pause_end - pause_start;
        pause_until := pause_end;
      end loop;
    else
      complete_ledger := false;
    end if;
    if pg_catalog.abs(elapsed - documented_pause - net_value) > 1000 then complete_ledger := false; end if;
    insert into public.room_focus_sessions (user_id, session_id, start_ms, end_ms, net_ms, pauses, ledger_complete)
      values (owner_id, sid, start_value, end_value, net_value,
        case when complete_ledger then item->'pauses' else '[]'::jsonb end, complete_ledger);
    good := good + 1;
    prior_end := end_value;
  end loop;

  insert into public.room_focus_state (user_id, backup_revision, bar_hours, accepted, rejected)
    values (owner_id, rev, bar, good, bad)
    on conflict (user_id) do update set backup_revision = excluded.backup_revision, bar_hours = excluded.bar_hours,
      accepted = excluded.accepted, rejected = excluded.rejected, reconciled_at = clock_timestamp();
  return query select 'current'::text, good, bad, rev;
end;
$function$;
revoke execute on function public.reconcile_room_evidence() from public, anon;
grant execute on function public.reconcile_room_evidence() to authenticated;

-- Each member's focus per local day, split at the viewer's midnight like the Board.
create or replace function private.room_focus_days(board_timezone text, member_ids uuid[])
returns table(user_id uuid, day_key date, focus_ms bigint)
language sql stable security definer set search_path = '' as $function$
  with slices as (
    select f.user_id, f.net_ms, f.start_ms, f.end_ms, f.pauses, f.ledger_complete, d.day::date as day_key,
      greatest(f.start_ms, (extract(epoch from (d.day at time zone board_timezone)) * 1000)::bigint) as slice_start,
      least(f.end_ms, (extract(epoch from ((d.day + interval '1 day') at time zone board_timezone)) * 1000)::bigint) as slice_end
    from public.room_focus_sessions f
    cross join lateral pg_catalog.generate_series(
      (pg_catalog.to_timestamp(f.start_ms / 1000.0) at time zone board_timezone)::date::timestamp,
      (pg_catalog.to_timestamp((f.end_ms - 1) / 1000.0) at time zone board_timezone)::date::timestamp,
      interval '1 day'
    ) d(day)
    where f.user_id = any(member_ids)
  ), parts as (
    select s.user_id, s.day_key,
      case when s.ledger_complete then
        greatest(0, s.slice_end - s.slice_start - coalesce(p.paused_ms, 0))::bigint
      else
        (pg_catalog.round(s.net_ms::numeric * (s.slice_end - s.start_ms) / (s.end_ms - s.start_ms))
          - pg_catalog.round(s.net_ms::numeric * (s.slice_start - s.start_ms) / (s.end_ms - s.start_ms)))::bigint
      end as slice_ms
    from slices s
    cross join lateral (
      select sum(greatest(0, least(s.slice_end, (pause.value->>'end')::bigint) - greatest(s.slice_start, (pause.value->>'start')::bigint)))::bigint as paused_ms
      from pg_catalog.jsonb_array_elements(s.pauses) pause
    ) p
    where s.slice_end > s.slice_start
  )
  select p.user_id, p.day_key, sum(p.slice_ms)::bigint from parts p group by p.user_id, p.day_key;
$function$;
revoke all on function private.room_focus_days(text, uuid[]) from public, anon, authenticated;

-- A room's members with their focus totals. Members who never synced have no
-- row in room_focus_state and come back with synced_at null.
create or replace function public.room_pace_rows(target_squad uuid, board_timezone text)
returns table(user_id uuid, today_ms bigint, week_ms bigint, month_ms bigint, bar_hours numeric, synced_at timestamptz)
language plpgsql stable security definer set search_path = '' as $function$
declare anchor date;
declare members uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.squad_members m where m.squad_id = target_squad and m.user_id = auth.uid() and m.status = 'accepted') then
    raise exception 'Only room members can see room progress' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = board_timezone) then raise exception 'Invalid timezone'; end if;
  anchor := (now() at time zone board_timezone)::date;
  select pg_catalog.array_agg(m.user_id) into members from public.squad_members m where m.squad_id = target_squad and m.status = 'accepted';
  return query
    with totals as (
      select d.user_id,
        coalesce(sum(d.focus_ms) filter (where d.day_key = anchor), 0)::bigint as t,
        coalesce(sum(d.focus_ms) filter (where d.day_key between date_trunc('week', anchor::timestamp)::date and anchor), 0)::bigint as w,
        coalesce(sum(d.focus_ms) filter (where d.day_key between date_trunc('month', anchor::timestamp)::date and anchor), 0)::bigint as mo
      from private.room_focus_days(board_timezone, members) d group by d.user_id
    )
    select u.id, coalesce(t.t, 0), coalesce(t.w, 0), coalesce(t.mo, 0), s.bar_hours, s.reconciled_at
    from pg_catalog.unnest(members) u(id)
    left join totals t on t.user_id = u.id
    left join public.room_focus_state s on s.user_id = u.id;
end;
$function$;
revoke execute on function public.room_pace_rows(uuid, text) from public, anon;
grant execute on function public.room_pace_rows(uuid, text) to authenticated;

-- Leaving your last room deletes your room copy.
create or replace function private.forget_room_focus_when_roomless()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if not exists (select 1 from public.squad_members m where m.user_id = old.user_id and m.status = 'accepted') then
    delete from public.room_focus_sessions where user_id = old.user_id;
    delete from public.room_focus_state where user_id = old.user_id;
  end if;
  return null;
end;
$function$;
revoke all on function private.forget_room_focus_when_roomless() from public, anon, authenticated;
drop trigger if exists forget_room_focus_when_roomless on public.squad_members;
create trigger forget_room_focus_when_roomless after delete on public.squad_members
  for each row execute function private.forget_room_focus_when_roomless();

commit;
