-- ==============================================================================
-- YouDO — Push Dispatch (database → send-push Edge Function)
-- ==============================================================================
-- Push notifications are sent by the database, never by an app. A trigger sees
-- what actually changed, writes the notification text itself, and calls the
-- send-push Edge Function through pg_net with a shared secret. Apps can no
-- longer choose a recipient or the text of a notification.
--
-- Apply after user_push_tokens.sql and community_hashtags.sql. Rerunnable.
--
-- One-time setup (SQL Editor, replace both values; never commit them):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random 64-char secret>', 'push_webhook_secret');
-- Then set the same secret on the Edge Function:
--   supabase secrets set PUSH_WEBHOOK_SECRET=<same secret>
-- Without both secrets, pushes are skipped with a warning; user actions never fail.
-- ==============================================================================

create extension if not exists pg_net with schema extensions;

-- Internal helpers live outside the API-exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1. Dispatcher: queue one push for a set of users. pg_net sends it after the
--    transaction commits, so a rolled-back action never notifies anyone.
-- ------------------------------------------------------------------------------
create or replace function private.dispatch_push(
  target_users uuid[], push_title text, push_body text, push_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare base_url text;
declare push_secret text;
begin
  if target_users is null or pg_catalog.cardinality(target_users) = 0 then return; end if;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into push_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if base_url is null or push_secret is null then
    raise warning 'push skipped: vault secrets project_url and push_webhook_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := pg_catalog.rtrim(base_url, '/') || '/functions/v1/send-push',
    body := pg_catalog.jsonb_build_object(
      'userIds', pg_catalog.to_jsonb(target_users),
      'title', push_title,
      'body', coalesce(push_body, ''),
      'data', coalesce(push_data, '{}'::jsonb)
    ),
    headers := pg_catalog.jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', push_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  -- A notification is never worth failing the user's action.
  raise warning 'push dispatch failed: %', sqlerrm;
end; $$;

revoke all on function private.dispatch_push(uuid[], text, text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Hashtag requests: notify every requester when an admin replies or approves.
--    One review updates all matching requests, so each requester is notified.
-- ------------------------------------------------------------------------------
create or replace function private.push_hashtag_request_reviewed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tag_label text;
begin
  if new.status = 'waiting' then
    perform private.dispatch_push(
      array[new.requester_id],
      'Hashtag Support',
      'Admin replied to #' || new.exam_name || ': ' || new.admin_response,
      pg_catalog.jsonb_build_object('type', 'hashtag_reply', 'hashtag', new.exam_name, 'channel', 'public-hub')
    );
  elsif new.status = 'approved' then
    select label into tag_label from public.community_hashtags where id = new.resolved_hashtag_id;
    perform private.dispatch_push(
      array[new.requester_id],
      'Hashtag Approved!',
      'Your request for #' || new.exam_name || ' was approved. You are now in #' || coalesce(tag_label, new.exam_name) || '.',
      pg_catalog.jsonb_build_object('type', 'hashtag_reply', 'hashtag', coalesce(tag_label, new.exam_name), 'channel', 'public-hub')
    );
  end if;
  return null;
end; $$;

revoke all on function private.push_hashtag_request_reviewed() from public, anon, authenticated;

drop trigger if exists trg_push_hashtag_request_reviewed on public.community_hashtag_requests;
create trigger trg_push_hashtag_request_reviewed
  after update of status, admin_response on public.community_hashtag_requests
  for each row
  when (new.status in ('waiting', 'approved')
    and (old.status is distinct from new.status or old.admin_response is distinct from new.admin_response))
  execute function private.push_hashtag_request_reviewed();

-- ------------------------------------------------------------------------------
-- 3. Device tokens: a device belongs to the account signed in on it. Claiming a
--    token removes it from any previous account, so after an account switch the
--    old account's notifications stop arriving on this device.
-- ------------------------------------------------------------------------------
create or replace function public.claim_push_token(push_token text, push_platform text default 'android')
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if push_token is null or pg_catalog.char_length(push_token) not between 20 and 4096 then
    raise exception 'Invalid push token';
  end if;
  delete from public.user_push_tokens where token = push_token and user_id <> me;
  insert into public.user_push_tokens(user_id, token, platform, updated_at)
    values (me, push_token, coalesce(nullif(pg_catalog.btrim(push_platform), ''), 'android'), pg_catalog.now())
    on conflict (user_id, token) do update set platform = excluded.platform, updated_at = excluded.updated_at;
end; $$;

revoke execute on function public.claim_push_token(text, text) from public, anon;
grant execute on function public.claim_push_token(text, text) to authenticated;
