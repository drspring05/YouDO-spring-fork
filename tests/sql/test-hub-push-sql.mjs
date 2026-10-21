// Isolated PostgreSQL checks for hub_push.sql: which Private Hub events send a
// push while the app is closed, to whom, and how each person's switches apply.
// pg_net is replaced by a recorder; nothing is sent.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SUPABASE_SETUP_ORDER } from '../../scripts/supabase-setup-order.mjs';

const db = new PGlite();
const id = (n) => `40000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
let checks = 0;
const check = (ok, label) => { assert.ok(ok, label); checks++; };
const sent = async () => rows('select body from net.calls order by id');
const clear = () => db.exec('delete from net.calls');

try {
  const harness = (await readFile(new URL('./test-full-setup-sql.mjs', import.meta.url), 'utf8')).match(/await db\.exec\(`([\s\S]*?)`\);/)[1]
    .replace(/create function net\.http_post[\s\S]*?\$\$select 1::bigint\$\$;/, '');
  await db.exec(harness);
  await db.exec(`create table net.calls(id serial primary key, body jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$insert into net.calls(body) values(body) returning id$$;`);
  const load = async (name) => (await readFile(new URL(`../../supabase/${name}.sql`, import.meta.url), 'utf8'))
    .replace('create extension if not exists pgcrypto;', '')
    .replace('create extension if not exists pg_net with schema extensions;', '');
  for (const name of SUPABASE_SETUP_ORDER) await db.exec(await load(name));
  await db.exec(await load('hub_push'));
  check(true, 'hub_push.sql is rerunnable on a full project');

  await db.query("insert into vault.decrypted_secrets values('project_url','https://example.supabase.co'),('push_webhook_secret',$1) on conflict do nothing", ['s'.repeat(64)]);
  const people = ['asha', 'ben', 'chen', 'dev'];
  for (let n = 1; n <= people.length; n++) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id(n), `${people[n - 1]}@example.com`]);
    await db.query('insert into public.profiles(id,username,display_name) values($1,$2,$3) on conflict (id) do update set username=excluded.username, display_name=excluded.display_name', [id(n), people[n - 1], people[n - 1][0].toUpperCase() + people[n - 1].slice(1)]);
  }
  await clear();

  // Direct message: one push to the receiver, tagged per chat, with the text.
  await db.query('insert into public.direct_messages(sender_id,receiver_id,content) values($1,$2,$3)', [id(1), id(2), 'Revision at 7?']);
  let calls = await sent();
  check(calls.length === 1, 'a direct message sends one push');
  check(calls[0].body.userIds[0] === id(2), 'it goes to the receiver only');
  check(calls[0].body.title === 'Asha' && calls[0].body.body === 'Revision at 7?', 'it shows who wrote and the message');
  check(calls[0].body.data.tag === `dm-${id(1)}` && calls[0].body.data.type === 'dm', 'it is tagged per chat so it updates in place');
  check(calls[0].body.data.sender === id(1) && !('from' in calls[0].body.data), 'it names the sender without FCM-reserved keys');

  // Previews off: the text is hidden. Messages off: nothing is sent.
  await clear();
  await db.query('insert into public.push_preferences(user_id,message_previews) values($1,false)', [id(2)]);
  await db.query('insert into public.direct_messages(sender_id,receiver_id,content) values($1,$2,$3)', [id(1), id(2), 'Secret plan']);
  calls = await sent();
  check(calls[0].body.body === '2 new messages', 'with previews off the message text is hidden');
  check(calls[0].body.title === 'Asha (2 messages)', 'a second unread message is counted in the title');
  await clear();
  await db.query('update public.push_preferences set direct_messages=false where user_id=$1', [id(2)]);
  await db.query('insert into public.direct_messages(sender_id,receiver_id,content) values($1,$2,$3)', [id(1), id(2), 'Hello?']);
  check((await sent()).length === 0, 'with direct messages off nothing is sent');
  await clear();
  await db.query('update public.push_preferences set direct_messages=true, private_hub=false where user_id=$1', [id(2)]);
  await db.query('insert into public.direct_messages(sender_id,receiver_id,content) values($1,$2,$3)', [id(1), id(2), 'Hello again']);
  check((await sent()).length === 0, 'the Private Hub master switch silences everything');
  await db.query('delete from public.push_preferences where user_id=$1', [id(2)]);

  // Friend request: the receiver, once; accepting it is in-app only.
  await clear();
  await db.query("insert into public.friendships(requester_id,receiver_id,status) values($1,$2,'pending')", [id(3), id(4)]);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds[0] === id(4) && calls[0].body.data.type === 'friend_request', 'a friend request notifies the receiver');
  await clear();
  await db.query("update public.friendships set status='accepted' where requester_id=$1", [id(3)]);
  check((await sent()).length === 0, 'an accepted friend request does not push');

  // Rooms: invite, join request to admins, approval.
  await db.query("insert into public.squads(id,name,created_by) values($1,'Night Owls',$2)", [id(90), id(1)]);
  await db.query("insert into public.squad_members(squad_id,user_id,role,status) values($1,$2,'admin','accepted')", [id(90), id(1)]);
  await clear();
  await db.query("insert into public.squad_members(squad_id,user_id,status) values($1,$2,'invited')", [id(90), id(2)]);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds[0] === id(2) && /Night Owls/.test(calls[0].body.body), 'a room invite notifies the invitee');
  await clear();
  await db.query("insert into public.squad_members(squad_id,user_id,status) values($1,$2,'pending')", [id(90), id(3)]);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds.length === 1 && calls[0].body.userIds[0] === id(1), 'a join request notifies the room admins only');
  await clear();
  await db.query("update public.squad_members set status='accepted' where squad_id=$1 and user_id=$2", [id(90), id(3)]);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds[0] === id(3) && calls[0].body.title === "You're in", 'an approved request notifies the new member');
  await clear();
  await db.query("update public.squad_members set status='accepted' where squad_id=$1 and user_id=$2", [id(90), id(2)]);
  check((await sent()).length === 0, 'accepting an invite does not push');

  // Room chat: @mentions push; ordinary messages only to those who chose "All messages".
  await clear();
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), 'Good session everyone']);
  check((await sent()).length === 0, 'an ordinary room message does not push');
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), '@ben and @chen, mock test at 9']);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds.length === 2, 'mentioned room-mates are notified together');
  check(!calls[0].body.userIds.includes(id(4)), 'non-members are never notified');
  await clear();
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), 'email me at x@benny.com']);
  check((await sent()).length === 0, 'a username inside a longer word is not a mention');
  await db.query("insert into public.push_preferences(user_id,room_messages) values($1,'all') on conflict (user_id) do update set room_messages='all'", [id(3)]);
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), 'Break till 6']);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds.length === 1 && calls[0].body.userIds[0] === id(3), '"All messages" members get every room message');
  check(calls[0].body.title === 'Night Owls' && calls[0].body.body === 'Asha: Break till 6' && calls[0].body.data.tag === `room-${id(90)}`, 'it names the room and the sender, one notification per room');
  await clear();
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), '@chen your turn']);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds[0] === id(3) && /in Night Owls/.test(calls[0].body.title), 'a mentioned "All messages" member gets the mention, once');
  await clear();
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), '@all mock at 9']);
  calls = await sent();
  check(calls.length === 1 && calls[0].body.userIds.length === 2 && !calls[0].body.userIds.includes(id(1)), '@all mentions every other member');
  await clear();
  await db.query("insert into public.push_preferences(user_id,room_messages) values($1,'off') on conflict (user_id) do update set room_messages='off'", [id(2)]);
  await db.query('insert into public.squad_messages(squad_id,sender_id,content) values($1,$2,$3)', [id(90), id(1), '@ben ping']);
  check(!(await sent()).some((call) => call.body.userIds.includes(id(2))), 'room notifications off silences mentions');
  const roomDefault = await db.query("select column_default from information_schema.columns where table_name='push_preferences' and column_name='room_messages'");
  check(String(roomDefault.rows[0].column_default).includes('mentions'), 'rooms default to mentions only');

  console.log(`PASS: ${checks} isolated PostgreSQL checks for Private Hub pushes (who, when, switches, previews, mentions).`);
} finally {
  await db.close();
}
