-- ==============================================================================
-- YouDO — Profiles hardening
-- ==============================================================================
-- One-off patch for projects set up before 2026-10-21. Not part of the setup
-- order: full_hub_rooms_setup.sql, hub_backers.sql and user_push_tokens.sql
-- already contain these changes for new projects.
--
-- 1. Signed-out visitors (the public anon key) can no longer read profiles.
--    The app only reads profiles while signed in.
-- 2. Members can no longer set their own Founding Backer badge. Only the admin
--    review (review_hub_backer, SECURITY DEFINER) can change it.
-- 3. cleanup_stale_push_tokens gets a fixed search_path like every other
--    SECURITY DEFINER function.
--
-- Rerunnable.
-- ==============================================================================

begin;

revoke all on table public.profiles from anon;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles are viewable by signed-in users" on public.profiles;
create policy "Profiles are viewable by signed-in users" on public.profiles for select to authenticated using (true);

create or replace function public.protect_profile_backer_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_backer := false;
      new.backer_tier := null;
    else
      new.is_backer := old.is_backer;
      new.backer_tier := old.backer_tier;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_backer_fields on public.profiles;
create trigger trg_protect_profile_backer_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_backer_fields();

alter function public.cleanup_stale_push_tokens() set search_path = public;

commit;
