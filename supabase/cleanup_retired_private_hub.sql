-- One-off cleanup for projects set up before v8.0.0. Not part of the setup order.
--
-- 1. The Private Hub on/off switch (private_hub_access.sql): the Private Hub is
--    now always available to signed-in users and the app no longer calls it.
--    Past "private hub enabled/disabled" rows in community_audit_log are kept.
-- 2. The Private Hub waitlist (hub_waitlist and its two functions): the hub is
--    open, so the waitlist and its sign-ups are deleted. Backer claims
--    (hub_backers) are untouched.
--
-- Rerunnable. Deleting the waitlist cannot be undone.

begin;

drop function if exists public.set_private_hub_enabled(boolean);
drop function if exists public.private_hub_access();
drop table if exists public.private_hub_settings;

drop function if exists public.join_hub_waitlist(text);
drop function if exists public.get_hub_waitlist_status(text);
drop table if exists public.hub_waitlist;

commit;
