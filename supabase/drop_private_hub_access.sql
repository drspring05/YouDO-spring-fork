-- Removes the retired Private Hub on/off switch (private_hub_access.sql).
-- The Private Hub is now always available to signed-in users, and the app no
-- longer calls these functions. Run once on projects that applied
-- private_hub_access.sql. Rerunnable. Not part of the setup order.
-- Past "private hub enabled/disabled" rows in community_audit_log are kept.

begin;

drop function if exists public.set_private_hub_enabled(boolean);
drop function if exists public.private_hub_access();
drop table if exists public.private_hub_settings;

commit;
