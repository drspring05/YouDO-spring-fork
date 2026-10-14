// Concatenate supabase/*.sql in SUPABASE_SETUP_ORDER into one script for a new
// (test) project's SQL Editor. Usage: node scripts/build-supabase-setup.mjs <out.sql>
import { readFile, writeFile } from 'node:fs/promises';
import { SUPABASE_SETUP_ORDER } from './supabase-setup-order.mjs';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/build-supabase-setup.mjs <out.sql>');
  process.exit(1);
}
const parts = [`-- YouDO complete setup for a NEW project, generated from supabase/*.sql.\n-- Order: ${SUPABASE_SETUP_ORDER.join(', ')}\n`];
for (const name of SUPABASE_SETUP_ORDER) {
  const sql = await readFile(new URL(`../supabase/${name}.sql`, import.meta.url), 'utf8');
  parts.push(`\n-- ===== ${name}.sql =====\n${sql.replace(/^﻿/, '')}\n`);
}
await writeFile(out, parts.join(''), 'utf8');
console.log(`Wrote ${out} (${SUPABASE_SETUP_ORDER.length} files).`);
