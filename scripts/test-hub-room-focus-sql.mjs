// Isolated PostgreSQL contract tests for room focus: progress without the
// Public Board, visible only to room-mates, forgotten after the last room.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const id = (n) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const as = async (user) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ? id(user) : '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
};
const system = async () => { await db.exec('reset role'); };
const fails = async (sql, args, label) => {
  let failed = false;
  try { await db.query(sql, args); } catch { failed = true; }
  check(failed, label);
};

const HOUR = 3_600_000;
const now = Date.now();
// A one-hour session that ended ten minutes ago, with a documented 5-minute pause.
function session(idSuffix, startAgoMs, durationMs, pausedMs = 0) {
  const start = now - startAgoMs;
  const end = start + durationMs;
  const pauses = pausedMs ? [{ start: start + 60_000, end: start + 60_000 + pausedMs }] : [];
  return { id: `s-${idSuffix}`, taskId: 't', startTime: start, endTime: end, pausedDuration: pausedMs, pauses, netFocusMs: durationMs - pausedMs, completed: true };
}
async function backup(user, sessions, barHours = 4) {
  await system();
  const payload = JSON.stringify({ sessionHistory: { day: sessions }, streakMeta: { barHours } });
  await db.query(
    'insert into public.user_backups(user_id, backup_data) values ($1,$2) on conflict (user_id) do update set backup_data = excluded.backup_data',
    [id(user), payload],
  );
}

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
  for (const name of ['user_backups', 'cloud_backup_revisions', 'public_pace', 'board_evidence', 'full_hub_rooms_setup', 'hub_room_membership']) {
    await db.exec((await readFile(new URL(`../supabase/${name}.sql`, import.meta.url), 'utf8')).replace('create extension if not exists pgcrypto;', ''));
  }
  const migration = await readFile(new URL('../supabase/hub_room_focus.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  check(true, 'room focus migration is rerunnable');

  for (let n = 1; n <= 4; n++) await db.query('insert into auth.users values ($1)', [id(n)]);
  const ROOM = '70000000-0000-4000-8000-0000000000a1';
  await system();
  await db.query("insert into public.squads(id,name,privacy,created_by) values ($1,'Room','invite_only',$2)", [ROOM, id(1)]);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values ($1,$2,'admin','accepted'),($1,$3,'member','accepted'),($1,$4,'member','accepted')", [ROOM, id(1), id(2), id(3)]);

  // Member 2 is NOT on the Public Board (no public_pace row) and still counts.
  check((await rows('select count(*)::int n from public.public_pace')).every((r) => r.n === 0), 'nobody here joined the Public Board');
  await backup(2, [session('a', HOUR + 10 * 60_000, HOUR, 5 * 60_000), session('old', 50 * 24 * HOUR, HOUR), { id: 'bad', startTime: 'x' }], 3);
  await as(2);
  const result = (await rows('select * from public.reconcile_room_evidence()'))[0];
  check(result.status === 'current' && result.accepted === 1 && result.rejected === 1, 'sessions are checked like the Board; older than 40 days are skipped, malformed ones rejected');
  check((await rows('select * from public.reconcile_room_evidence()'))[0].status === 'current', 'reconciling the same backup twice is a no-op');

  await as(1);
  const board = await rows("select * from public.room_pace_rows($1, 'UTC')", [ROOM]);
  const m2 = board.find((r) => r.user_id === id(2));
  const m3 = board.find((r) => r.user_id === id(3));
  check(board.length === 3, 'every accepted member gets a row');
  check(Number(m2.today_ms) + Number(m2.week_ms) > 0 && Number(m2.month_ms) >= 55 * 60_000 - 2000 && Number(m2.month_ms) <= 55 * 60_000 + 2000, 'an off-board member’s focus (minus pauses) counts in the room');
  check(Number(m2.bar_hours) === 3, 'their personal daily bar comes from their backup');
  check(m3.synced_at === null && Number(m3.today_ms) === 0, 'a member who never synced reads as not synced');

  // Only room-mates.
  await as(4);
  await fails("select * from public.room_pace_rows($1, 'UTC')", [ROOM], 'outsiders cannot read room progress');
  await fails('select * from public.room_focus_sessions', [], 'nobody reads raw room sessions');
  await fails('select * from public.room_focus_state', [], 'nobody reads room focus state directly');
  check((await rows('select * from public.reconcile_room_evidence()'))[0].status === 'not_in_room', 'people without a room store nothing');
  await as(null);
  await fails("select * from public.room_pace_rows($1, 'UTC')", [ROOM], 'anonymous users get nothing');
  await as(1);
  await fails("select * from public.room_pace_rows($1, 'Not/AZone')", [ROOM], 'invalid time zones are refused');

  // Leaving the last room deletes the room copy.
  await as(2);
  await db.query('delete from public.squad_members where squad_id=$1 and user_id=$2', [ROOM, id(2)]);
  await system();
  check((await rows('select count(*)::int n from public.room_focus_sessions where user_id=$1', [id(2)]))[0].n === 0, 'leaving the last room deletes room sessions');
  check((await rows('select count(*)::int n from public.room_focus_state where user_id=$1', [id(2)]))[0].n === 0, 'and the room focus state');

  console.log(`PASS: ${checks} isolated PostgreSQL checks for room focus (off-board members count, room-mates only, forgotten on leaving).`);
} finally {
  await db.close();
}
