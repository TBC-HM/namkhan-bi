// scripts/load-poster-receipts.mjs
//
// Loads the batched SQL files in `_poster_sql/` (under cloudbeds-Vercel-portal)
// into pos.poster_receipts via the public.exec_sql() SECURITY-DEFINER RPC.
// Each file is an INSERT … FROM jsonb_to_recordset with ON CONFLICT DO NOTHING,
// so re-running is safe.
//
// Usage:
//   cd ~/Desktop/namkhan-bi
//   node scripts/load-poster-receipts.mjs

import { readdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(path) {
  try {
    const txt = readFileSync(path, 'utf-8');
    for (const raw of txt.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* ignore */ }
}
loadEnv('/Users/paulbauer/Desktop/namkhan-bi/.env.local');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kpenyneooigsyuuomgct.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SRK) {
  console.error('\n❌  Missing SUPABASE_SERVICE_ROLE_KEY in /Users/paulbauer/Desktop/namkhan-bi/.env.local');
  console.error('    Get the value from: Supabase Dashboard → Settings → API → service_role key');
  console.error('    Add this line to .env.local (no quotes needed):');
  console.error('        SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>');
  console.error('    Then re-run this command.\n');
  process.exit(1);
}

const SQL_DIR = '/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/_poster_sql';

async function execSql(sql) {
  const r = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`HTTP ${r.status}: ${t.slice(0, 400)}`);
  }
}

// Use the small 100-row b###.sql files; ignore the older 200-row b####.sql duplicates.
const all = await readdir(SQL_DIR);
const files = all.filter((n) => /^b\d{3}\.sql$/.test(n)).sort();
console.log(`Loading ${files.length} batches from ${SQL_DIR}\n`);
let n = 0, failed = 0;
for (const f of files) {
  const sql = await readFile(join(SQL_DIR, f), 'utf-8');
  try {
    await execSql(sql);
    n++;
    if (n % 10 === 0) console.log(`  ${n}/${files.length} ok`);
  } catch (e) {
    failed++;
    console.error(`  ${f} FAILED: ${e.message}`);
    if (failed > 5) {
      console.error('Too many failures — aborting.');
      break;
    }
  }
}
console.log(`\nDone. ${n} batches ok · ${failed} failed.`);

// Final count via PostgREST
const cr = await fetch(`${URL}/rest/v1/poster_receipts?select=count&limit=1`, {
  headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, Accept: 'application/json', 'Accept-Profile': 'pos', Prefer: 'count=exact' },
});
const total = cr.headers.get('content-range')?.split('/')?.[1] ?? '?';
console.log(`pos.poster_receipts now has ${total} rows.`);
