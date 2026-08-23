#!/usr/bin/env node
// scripts/sync-route-registry.mjs
// brief route_canon_registry-v1 · D2 — push .route-registry.json into governance.route_registry
//
// Run AFTER scripts/check-routes.mjs --json. Idempotent: upserts on route_path.
// Never writes decision / decision_by / decision_at / decision_note — those are human-owned.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-route-registry.mjs
//
// Exit 0 on success, 1 on failure. Safe to skip when env is absent (local dev):
// pass --optional to turn a missing key into a warning instead of an error.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OPTIONAL = process.argv.includes('--optional');
const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function bail(msg) {
  if (OPTIONAL) { console.warn('route-registry sync skipped: ' + msg); process.exit(0); }
  console.error('route-registry sync FAILED: ' + msg); process.exit(1);
}

if (!URL_ || !KEY) bail('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');

const file = join(ROOT, '.route-registry.json');
if (!existsSync(file)) bail('.route-registry.json missing — run scripts/check-routes.mjs --json first');

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}

const { routes, summary } = JSON.parse(readFileSync(file, 'utf8'));

const payload = routes.map((r) => ({
  route_path: r.route_path,
  file_path: r.file,
  tree: r.tree,
  twin_path: r.twin_path,
  twin_state: r.twin_state,
  is_stub: r.is_stub,
  is_redirect_only: r.is_redirect_only,
  reachability: r.reachability,
  defects: r.defects,
  scanned_commit: commit,
  last_seen_at: new Date().toISOString(),
}));

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Content-Profile': 'governance',
  'Accept-Profile': 'governance',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};

const CHUNK = 200;
let sent = 0;

for (let i = 0; i < payload.length; i += CHUNK) {
  const slice = payload.slice(i, i + CHUNK);
  const res = await fetch(`${URL_}/rest/v1/route_registry?on_conflict=route_path`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(slice),
  });
  if (!res.ok) bail(`upsert ${i}-${i + slice.length}: HTTP ${res.status} ${await res.text()}`);
  sent += slice.length;
}

// Routes that vanished from the repo: keep the row (history + any human decision),
// but mark the tree so the Drift tab can surface them. Never delete.
const live = new Set(routes.map((r) => r.route_path));
const existing = await (await fetch(
  `${URL_}/rest/v1/route_registry?select=route_path,tree`,
  { headers: { ...HEADERS, Prefer: '' } }
)).json();

const gone = (Array.isArray(existing) ? existing : [])
  .filter((r) => !live.has(r.route_path) && r.tree !== 'removed')
  .map((r) => r.route_path);

for (const route_path of gone) {
  await fetch(`${URL_}/rest/v1/route_registry?route_path=eq.${encodeURIComponent(route_path)}`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify({ tree: 'removed' }),
  });
}

console.log(`route-registry sync OK · ${sent} upserted · ${gone.length} marked removed · commit ${commit}`);
console.log('  ' + Object.entries(summary).map(([k, v]) => `${k}=${v}`).join(' '));
