-- Supabase Snippet Name: YouDO — DM Goal Share
-- Apply after full_hub_rooms_setup.sql. Rerunnable.
-- Run the whole query once in the private Supabase SQL Editor (do not save it).
--
-- A direct message can carry one shared goal tree (titles, descriptions,
-- structure, steps and, only if the sender chose, their progress). The
-- message text stays readable ("🎯 Shared a goal: …"), so push previews, the
-- inbox and older app versions need no change. Existing RLS covers the column:
-- only the sender writes it and only the two participants read it.

begin;

alter table public.direct_messages add column if not exists goal_share jsonb;

alter table public.direct_messages drop constraint if exists direct_messages_goal_share_size;
alter table public.direct_messages add constraint direct_messages_goal_share_size
  check (goal_share is null or (pg_catalog.jsonb_typeof(goal_share) = 'object' and pg_catalog.pg_column_size(goal_share) <= 262144));

commit;
