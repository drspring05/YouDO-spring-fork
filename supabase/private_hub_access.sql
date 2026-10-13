-- ==============================================================================
-- YouDO — Private Hub access switch (Admin Hub)
-- ==============================================================================
-- One server-side switch decides whether members can open the Private Hub.
-- Admins can always open it, so it can be tested before launch. Off by default:
-- applying this file changes nothing for members until an admin turns it on.
--
-- Apply after community.sql (is_community_admin, community_audit_log). Rerunnable.
-- ==============================================================================

begin;

create table if not exists public.private_hub_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.private_hub_settings (id) values (1) on conflict (id) do nothing;

-- Read and changed only through the functions below.
alter table public.private_hub_settings enable row level security;
revoke all on public.private_hub_settings from anon, authenticated;

create or replace function public.private_hub_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'enabled', coalesce((select s.enabled from public.private_hub_settings s where s.id = 1), false),
    'isAdmin', public.is_community_admin()
  );
$$;

revoke execute on function public.private_hub_access() from public, anon;
grant execute on function public.private_hub_access() to authenticated;

create or replace function public.set_private_hub_enabled(next_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_community_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if next_enabled is null then raise exception 'Choose on or off'; end if;
  update public.private_hub_settings
    set enabled = next_enabled, updated_by = auth.uid(), updated_at = pg_catalog.now()
    where id = 1 and enabled is distinct from next_enabled;
  if found then
    insert into public.community_audit_log (admin_id, action)
      values (auth.uid(), case when next_enabled then 'settings.private_hub.enabled' else 'settings.private_hub.disabled' end);
  end if;
  return public.private_hub_access();
end; $$;

revoke execute on function public.set_private_hub_enabled(boolean) from public, anon;
grant execute on function public.set_private_hub_enabled(boolean) to authenticated;

commit;
