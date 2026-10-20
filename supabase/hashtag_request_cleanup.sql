-- Supabase Snippet Name: YouDO — Hashtag Request Cleanup
-- Apply after community_hashtag_admin.sql. Additive and safe to rerun.
-- Run the whole query once in the private Supabase SQL Editor (do not save it).
--
-- 1. A member can cancel a pending request, or clear a declined one, from
--    Explore rooms. The row is deleted, so it leaves the admin queue too.
-- 2. Deleting a hashtag (both "Delete hashtag" and the permanent delete) also
--    clears every open, waiting or declined request for that exam.

begin;

create or replace function public.withdraw_community_hashtag_request(target_request uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from public.community_hashtag_requests
    where id=target_request and requester_id=auth.uid() and status in ('open','waiting','declined');
  return found;
end; $$;

revoke execute on function public.withdraw_community_hashtag_request(uuid) from public,anon;
grant execute on function public.withdraw_community_hashtag_request(uuid) to authenticated;

create or replace function public.manage_community_hashtag(
  requested_action text, target_hashtag uuid default null, requested_label text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare clean_label text := upper(regexp_replace(btrim(regexp_replace(coalesce(requested_label,''),'^#+','','g')),'\s+','-','g'));
declare normalized_tag text := lower(regexp_replace(clean_label,'[^a-zA-Z0-9]+','','g'));
declare tag public.community_hashtags;
declare removed_members bigint := 0;
begin
  if not public.is_community_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if requested_action not in ('create','rename','archive','restore','delete') then raise exception 'Unknown hashtag action'; end if;
  if requested_action in ('create','rename') then
    if char_length(clean_label) not between 2 and 24 or char_length(normalized_tag)<2 then
      raise exception 'Write a recognisable hashtag label of 2–24 characters';
    end if;
  end if;

  if requested_action='create' then
    if target_hashtag is not null then raise exception 'A new hashtag cannot have an existing ID'; end if;
    if exists(select 1 from public.community_hashtags where normalized_label=normalized_tag) then
      raise exception 'This hashtag already exists. Edit or restore it instead.';
    end if;
    insert into public.community_hashtags(label,normalized_label,created_by)
      values(clean_label,normalized_tag,auth.uid()) returning * into tag;
    -- Match the existing request approval behavior for people waiting on this exam.
    insert into public.community_hashtag_memberships(user_id,hashtag_id)
      select distinct r.requester_id,tag.id from public.community_hashtag_requests r
      where r.normalized_exam=normalized_tag and r.status in ('open','waiting')
      on conflict(user_id) do update set hashtag_id=excluded.hashtag_id,updated_at=now();
    update public.community_hashtag_requests set status='approved',resolved_hashtag_id=tag.id,
      reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      where normalized_exam=normalized_tag and status in ('open','waiting');
    insert into public.community_audit_log(admin_id,action,reason)
      values(auth.uid(),'hashtag.admin.created','#'||tag.label);
  else
    if target_hashtag is null then raise exception 'Choose a hashtag'; end if;
    select * into tag from public.community_hashtags where id=target_hashtag for update;
    if tag.id is null then raise exception 'Hashtag not found'; end if;
    if requested_action='rename' then
      if not tag.active then raise exception 'Restore this hashtag before editing it'; end if;
      if exists(select 1 from public.community_hashtags where normalized_label=normalized_tag and id<>tag.id) then
        raise exception 'Another hashtag already uses this label';
      end if;
      if tag.label=clean_label and tag.normalized_label=normalized_tag then return pg_catalog.to_jsonb(tag); end if;
      update public.community_hashtags set label=clean_label,normalized_label=normalized_tag,updated_at=now()
        where id=tag.id returning * into tag;
      insert into public.community_audit_log(admin_id,action,reason)
        values(auth.uid(),'hashtag.admin.renamed','#'||tag.label);
    elsif requested_action='archive' then
      if not tag.active then raise exception 'Hashtag is already removed'; end if;
      delete from public.community_hashtag_memberships where hashtag_id=tag.id;
      get diagnostics removed_members = row_count;
      -- Requests for this exam leave the admin queue and the requesters' lists.
      delete from public.community_hashtag_requests
        where normalized_exam=tag.normalized_label and status in ('open','waiting','declined');
      update public.community_hashtags set active=false,updated_at=now() where id=tag.id returning * into tag;
      insert into public.community_audit_log(admin_id,action,reason)
        values(auth.uid(),'hashtag.admin.archived','#'||tag.label||' · '||removed_members||' members unassigned');
      elsif requested_action='delete' then
        if tag.active then raise exception 'Hashtag must be removed first'; end if;
        delete from public.community_hashtag_requests
          where normalized_exam=tag.normalized_label and status in ('open','waiting','declined');
        delete from public.community_hashtags where id=tag.id;
        insert into public.community_audit_log(admin_id,action,reason)
          values(auth.uid(),'hashtag.admin.deleted','#'||tag.label);
      else
      if tag.active then raise exception 'Hashtag is already active'; end if;
      update public.community_hashtags set active=true,updated_at=now() where id=tag.id returning * into tag;
      insert into public.community_audit_log(admin_id,action,reason)
        values(auth.uid(),'hashtag.admin.restored','#'||tag.label);
    end if;
  end if;
  return pg_catalog.jsonb_build_object('id',tag.id,'label',tag.label,'active',tag.active,'members_unassigned',removed_members);
end; $$;

revoke execute on function public.manage_community_hashtag(text,uuid,text) from public,anon;
grant execute on function public.manage_community_hashtag(text,uuid,text) to authenticated;

commit;
