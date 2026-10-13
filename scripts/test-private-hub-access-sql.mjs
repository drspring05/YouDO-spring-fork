// Isolated PostgreSQL contract tests for the Private Hub access switch.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db=new PGlite();
const id=n=>`40000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const as=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
const system=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
const access=async()=>(await rows('select public.private_hub_access() a'))[0].a;
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const denied=async(sql,args=[])=>{let failed=false;try{await db.query(sql,args);}catch{failed=true;}check(failed,`Expected denial: ${sql}`);};
try{
  await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
    create table auth.users(id uuid primary key,email text unique,created_at timestamptz not null default now(),email_confirmed_at timestamptz,last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    alter default privileges in schema public grant usage,select on sequences to authenticated;`);
  for(const file of ['user_backups','public_pace','community','community_chat']){
    await db.exec((await readFile(new URL(`../supabase/${file}.sql`,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto;',''));
  }
  const migration=await readFile(new URL('../supabase/private_hub_access.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  check(true,'private hub access migration is rerunnable');
  for(let n=1;n<=2;n++){
    await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`member${n}@example.com`]);
    await db.query('insert into public.public_pace(user_id,display_name) values($1,$2)',[id(n),`Member ${n}`]);
  }
  await system();await rows("select public.set_community_staff('member1@example.com','owner',true)");

  await as(2);
  check(JSON.stringify(await access())===JSON.stringify({enabled:false,isAdmin:false}),'the hub starts closed for members');
  await denied('select public.set_private_hub_enabled(true)');
  await denied('select * from public.private_hub_settings');
  await denied('update public.private_hub_settings set enabled=true');

  await as(1);
  check((await access()).isAdmin===true&&(await access()).enabled===false,'admins are told they can preview while it is closed');
  const opened=(await rows('select public.set_private_hub_enabled(true) a'))[0].a;
  check(opened.enabled===true,'an admin can open the hub');
  await rows('select public.set_private_hub_enabled(true)');
  await system();
  check((await rows("select count(*)::int n from public.community_audit_log where action='settings.private_hub.enabled'"))[0].n===1,'opening is audited once, repeating changes nothing');

  await as(2);
  check((await access()).enabled===true,'members see the hub once it is open');
  await as(1);await rows('select public.set_private_hub_enabled(false)');
  await as(2);check((await access()).enabled===false,'closing it again hides it from members');
  await system();
  check((await rows("select count(*)::int n from public.community_audit_log where action='settings.private_hub.disabled'"))[0].n===1,'closing is audited');

  await db.exec('set role anon');
  await denied('select public.private_hub_access()');
  await denied('select public.set_private_hub_enabled(true)');

  console.log(`PASS: ${checks} isolated PostgreSQL checks for the Private Hub switch (default off, admin-only changes, audit, anon denied).`);
}finally{
  await db.close();
}
