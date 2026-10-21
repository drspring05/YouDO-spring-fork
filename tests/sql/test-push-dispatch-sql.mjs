// Isolated PostgreSQL contract tests for database-driven push dispatch.
// pg_net and Vault are replaced by recording stand-ins with the same signatures.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db=new PGlite();
const id=n=>`30000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const as=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
const system=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
const calls=async()=>{await system();return rows('select url,body,headers from net.calls order by id');};
const SECRET='s'.repeat(64);
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const denied=async(sql,args=[])=>{let failed=false;try{await db.query(sql,args);}catch{failed=true;}check(failed,`Expected denial: ${sql}`);};
const recordingHttpPost=`create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds int default 5000)
  returns bigint language sql as $$insert into net.calls(url,body,headers) values(url,body,headers) returning id$$;`;
try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
    create table auth.users(id uuid primary key,email text unique,created_at timestamptz not null default now(),email_confirmed_at timestamptz,last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;
    alter default privileges in schema public grant all on tables to authenticated;
    alter default privileges in schema public grant usage,select on sequences to authenticated;
    create schema vault;create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
    create schema net;create table net.calls(id serial primary key,url text,body jsonb,headers jsonb);
    create schema extensions;`);
  await db.exec(recordingHttpPost);
  await db.exec(`create table public.user_backups(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,backup_data text not null,updated_at timestamptz not null default now(),constraint user_backups_user_id_key unique(user_id));`);
  for(const file of ['public_pace','community','community_chat','community_hashtags','user_push_tokens']){
    await db.exec((await readFile(new URL(`../../supabase/${file}.sql`,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
  }
  const migration=(await readFile(new URL('../../supabase/push_dispatch.sql',import.meta.url),'utf8'))
    .replace('create extension if not exists pg_net with schema extensions;','');
  await db.exec(migration);await db.exec(migration);
  check(true,'push dispatch migration is rerunnable');
  for(let n=1;n<=5;n++){
    await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`member${n}@example.com`]);
    await db.query('insert into public.public_pace(user_id,display_name) values($1,$2)',[id(n),`Member ${n}`]);
  }
  await system();await rows("select public.set_community_staff('member1@example.com','owner',true)");
  await as(3);await rows("select public.request_community_hashtag('GATE','Computer Science')");
  await as(4);await rows("select public.request_community_hashtag('gate','Mechanical')");
  await as(5);await rows("select public.request_community_hashtag('ESE','Civil')");

  // Without secrets the review still succeeds and nothing is sent.
  await as(1);let requests=await rows('select * from public.admin_community_hashtag_requests()');
  const gate=requests.find(row=>row.normalized_exam==='gate');
  const ese=requests.find(row=>row.normalized_exam==='ese');
  await rows("select public.review_community_hashtag_request($1,'wait','Waiting for more GATE aspirants',null)",[gate.id]);
  check((await calls()).length===0,'missing vault secrets skip the push without failing the review');

  await system();
  await db.query("insert into vault.decrypted_secrets values('project_url','https://example.supabase.co/'),('push_webhook_secret',$1)",[SECRET]);

  // One admin reply notifies every matching requester, each separately.
  await as(1);await rows("select public.review_community_hashtag_request($1,'wait','Need 10 more requests first',null)",[gate.id]);
  let sent=await calls();
  check(sent.length===2,'a reply to a shared exam request notifies each requester');
  check(new Set(sent.map(c=>c.body.userIds[0])).size===2&&sent.every(c=>[id(3),id(4)].includes(c.body.userIds[0])&&c.body.userIds.length===1),'each push targets exactly one requester');
  check(sent.every(c=>c.url==='https://example.supabase.co/functions/v1/send-push'),'pushes go to the send-push function of the project');
  check(sent.every(c=>c.headers['x-push-secret']===SECRET),'pushes carry the shared secret');
  check(sent.every(c=>c.body.title==='Hashtag Support'&&/^Admin replied to #gate: Need 10 more requests first$/i.test(c.body.body)),'the database writes the notification text, using each requester\'s own exam name');
  check(sent.every(c=>c.body.data.type==='hashtag_reply'&&c.body.data.channel==='public-hub'),'pushes carry the tap route and Android channel');

  // A rolled-back review queues nothing.
  await system();await db.exec('truncate net.calls');
  await as(1);await db.exec('begin');
  await rows("select public.review_community_hashtag_request($1,'wait','This reply is rolled back',null)",[gate.id]);
  await db.exec('rollback');
  check((await calls()).length===0,'a rolled-back review sends nothing');

  // Unrelated row updates do not notify again.
  await system();await db.query("update public.community_hashtag_requests set details='edited',updated_at=now() where normalized_exam='gate'");
  check((await calls()).length===0,'updates that change neither status nor reply send nothing');

  // Rejection stays in-app only.
  await as(1);await rows("select public.review_community_hashtag_request($1,'reject','',null)",[ese.id]);
  check((await calls()).length===0,'a rejected request sends no push');

  // Approval names the hashtag the admin actually created.
  await as(1);await rows("select public.review_community_hashtag_request($1,'create','Approved','GATE-CS')",[gate.id]);
  sent=await calls();
  check(sent.length===2&&sent.every(c=>c.body.title==='Hashtag Approved!'&&c.body.body.includes('You are now in #GATE-CS.')),'approval names the created hashtag for every requester');

  // A failing HTTP layer never blocks the admin's action.
  await system();await db.exec('truncate net.calls');
  await db.exec(`create or replace function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds int default 5000)
    returns bigint language plpgsql as $$begin raise exception 'network down';end$$;`);
  await as(3);await rows("select public.request_community_hashtag('UPSC','General studies')");
  await as(1);requests=await rows('select * from public.admin_community_hashtag_requests()');
  const upsc=requests.find(row=>row.normalized_exam==='upsc');
  await rows("select public.review_community_hashtag_request($1,'wait','Collecting more requests',null)",[upsc.id]);
  await system();
  check((await rows("select status from public.community_hashtag_requests where id=$1",[upsc.id]))[0].status==='waiting','a push failure does not roll back the review');
  await db.exec(recordingHttpPost);

  // Nobody but the database can dispatch.
  await as(3);
  await denied("select private.dispatch_push(array[$1]::uuid[],'Spoofed','Spoofed body','{}'::jsonb)",[id(4)]);
  await system();await db.exec('set role anon');
  await denied("select private.dispatch_push(array[$1]::uuid[],'Spoofed','Spoofed body','{}'::jsonb)",[id(4)]);

  // A device belongs to whoever signed in on it last.
  const token='fcm-token-'+'x'.repeat(40);
  await as(3);await rows('select public.claim_push_token($1)',[token]);
  await rows('select public.claim_push_token($1)',[token]);
  await system();check((await rows('select user_id from public.user_push_tokens where token=$1',[token])).map(r=>r.user_id).join()===id(3),'claiming twice keeps one row');
  await as(4);await rows('select public.claim_push_token($1)',[token]);
  await system();
  const owners=(await rows('select user_id from public.user_push_tokens where token=$1',[token])).map(r=>r.user_id);
  check(owners.length===1&&owners[0]===id(4),'switching accounts moves the device to the new account');
  await as(4);await denied('select public.claim_push_token($1)',['short']);
  await system();await db.exec('set role anon');
  await denied('select public.claim_push_token($1)',[token+'y']);
  await as(5);await rows('select public.claim_push_token($1)',['fcm-token-'+'z'.repeat(40)]);
  await as(4);check((await rows('select count(*)::int n from public.user_push_tokens'))[0].n===1,'members only see their own device rows');

  const exposed=await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE')
    and p.proname in ('claim_push_token','dispatch_push','push_hashtag_request_reviewed')`);
  check(exposed.length===0,'anonymous users cannot execute push functions');
  const unpinned=await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.prosecdef and not exists(select 1 from unnest(p.proconfig) c where c like 'search_path=%')`);
  check(unpinned.length===0,'private elevated functions pin their search path');

  console.log(`PASS: ${checks} isolated PostgreSQL checks for push dispatch (secrets, recipients, text, rollback, failures, token ownership).`);
}finally{
  await db.close();
}
