// Isolated PostgreSQL contract tests for room membership: joining, inviting,
// accepting, approving and the 4-member limit.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const id = (n) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const as = async (user) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ? id(user) : '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
};
const system = async () => { await db.exec('reset role'); };
const fails = async (sql, args, pattern, label) => {
  let message = '';
  try { await db.query(sql, args); } catch (error) { message = error.message; }
  check(message && (!pattern || pattern.test(message)), `${label} (got: ${message || 'no error'})`);
};
const status = async (squad, user) => {
  await system();
  return (await rows('select status, role from public.squad_members where squad_id=$1 and user_id=$2', [squad, id(user)]))[0] ?? null;
};

try {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create publication supabase_realtime;
  `);
  for (const name of ['user_backups', 'cloud_backup_revisions', 'public_pace', 'board_evidence', 'full_hub_rooms_setup']) {
    await db.exec((await readFile(new URL(`../../supabase/${name}.sql`, import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', ''));
  }
  const migration = await readFile(new URL('../../supabase/hub_room_membership.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  check(true, 'membership migration is rerunnable');

  for (let n = 1; n <= 7; n++) await db.query('insert into auth.users values ($1)', [id(n)]);
  const OPEN = '50000000-0000-4000-8000-0000000000a1';
  const CLOSED = '50000000-0000-4000-8000-0000000000a2';

  // The owner creates an open room and joins it as admin.
  await as(1);
  await db.query("insert into public.squads(id,name,privacy,created_by) values ($1,'Open room','anyone_can_join',$2)", [OPEN, id(1)]);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'admin','accepted')", [OPEN, id(1)]);
  await db.query("insert into public.squads(id,name,privacy,created_by) values ($1,'Invite only','invite_only',$2)", [CLOSED, id(1)]);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'admin','accepted')", [CLOSED, id(1)]);
  check((await status(OPEN, 1))?.role === 'admin', 'the creator joins their own room as admin');

  // Joining an open room is only ever a request.
  await as(2);
  await fails("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'admin','accepted')", [OPEN, id(2)], null, 'nobody can add themselves as an accepted admin');
  await fails("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','accepted')", [OPEN, id(2)], null, 'nobody can skip the join request');
  await fails("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','pending')", [CLOSED, id(2)], null, 'invite-only rooms take no join requests');
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','pending')", [OPEN, id(2)]);
  check((await status(OPEN, 2))?.status === 'pending', 'a member can ask to join an open room');

  // Only room admins invite.
  await as(1);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','invited')", [OPEN, id(3)]);
  await fails("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'admin','invited')", [OPEN, id(4)], null, 'invites cannot make someone admin');
  await as(3);
  await fails("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','invited')", [OPEN, id(4)], null, 'invited non-admins cannot invite others');

  // The old update path cannot accept (no UPDATE policy) ...
  await db.query("update public.squad_members set status='accepted', role='admin' where squad_id=$1 and user_id=$2", [OPEN, id(3)]);
  check((await status(OPEN, 3))?.status === 'invited', 'a direct update still cannot accept or promote');
  // ... the function can.
  await as(3);
  await rows('select public.accept_squad_invite($1)', [OPEN]);
  check((await status(OPEN, 3))?.status === 'accepted' && (await status(OPEN, 3))?.role === 'member', 'the invited member accepts and stays a member');
  await as(3);
  await fails('select public.accept_squad_invite($1)', [OPEN], /no longer available/, 'an invite can be accepted only once');
  await as(5);
  await fails('select public.accept_squad_invite($1)', [OPEN], /no longer available/, 'nobody accepts an invite they never got');

  // Approving a join request is for room admins only.
  await as(2);
  await fails('select public.approve_squad_join_request($1,$2)', [OPEN, id(2)], /Only room admins/, 'members cannot approve their own request');
  await as(3);
  await fails('select public.approve_squad_join_request($1,$2)', [OPEN, id(2)], /Only room admins/, 'ordinary members cannot approve requests');
  await as(1);
  await rows('select public.approve_squad_join_request($1,$2)', [OPEN, id(2)]);
  check((await status(OPEN, 2))?.status === 'accepted', 'the room admin approves a join request');
  await as(1);
  await fails('select public.approve_squad_join_request($1,$2)', [OPEN, id(2)], /no longer waiting/, 'a request is approved only once');

  // A room holds 4 members.
  await as(1);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','invited'),($1,$3,'member','invited')", [OPEN, id(4), id(5)]);
  await as(4); await rows('select public.accept_squad_invite($1)', [OPEN]);
  await as(5);
  await fails('select public.accept_squad_invite($1)', [OPEN], /room is full/, 'a fifth member cannot join');
  check((await status(OPEN, 5))?.status === 'invited', 'the refused invite stays open for later');
  await as(6);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'member','pending')", [OPEN, id(6)]);
  check((await status(OPEN, 6))?.status === 'pending', 'asking to join a full room is still allowed');
  await as(1);
  await fails('select public.approve_squad_join_request($1,$2)', [OPEN, id(6)], /room is full/, 'admins cannot approve past the limit');

  // Leaving frees a place.
  await as(4);
  await db.query('delete from public.squad_members where squad_id=$1 and user_id=$2', [OPEN, id(4)]);
  await as(5); await rows('select public.accept_squad_invite($1)', [OPEN]);
  check((await status(OPEN, 5))?.status === 'accepted', 'a place freed by leaving can be taken');

  // Only the creator deletes a room, and everything in it goes too.
  await as(2);
  await fails('select public.delete_squad($1)', [OPEN], /Only the room creator/, 'members cannot delete the room');
  await as(1);
  await rows('select public.delete_squad($1)', [OPEN]);
  await system();
  check((await rows('select count(*)::int n from public.squads where id=$1', [OPEN]))[0].n === 0, 'the creator deletes the room');
  check((await rows('select count(*)::int n from public.squad_members where squad_id=$1', [OPEN]))[0].n === 0, 'its members and requests go with it');

  // Anonymous callers get nothing.
  await as(null);
  await fails('select public.accept_squad_invite($1)', [OPEN], null, 'anonymous users cannot accept');
  await fails('select public.approve_squad_join_request($1,$2)', [OPEN, id(6)], null, 'anonymous users cannot approve');

  console.log(`PASS: ${checks} isolated PostgreSQL checks for room membership (join rules, invites, accept, approve, 4-member limit).`);
} finally {
  await db.close();
}
