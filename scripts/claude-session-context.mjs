#!/usr/bin/env node
/**
 * Claude Code SessionStart hook — injects the live constitution into context.
 * Whatever this prints to stdout is added to the model's context, so it must
 * print EITHER the constitution OR a loud failure notice. Never fail quietly —
 * a silent start without the constitution caused the 2026-08-19 incident.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.CLAUDE_PROJECT_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}

function fail(reason, fix) {
  console.log(`
=== PLATFORM CONTEXT: NOT LOADED ===
The constitution could NOT be injected. Reason: ${reason}

YOU ARE OPERATING WITHOUT THE CONSTITUTION. Before any architecture, schema,
agent or deployment work, load it yourself via the Supabase MCP:

    SELECT constitution FROM public.fn_claude_digest();

Do NOT substitute repo files or a pasted prompt for it (L1). Tell PBS the
SessionStart hook is not delivering, and why: ${fix}
====================================
`);
  process.exit(0);
}

loadDotEnv();

const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !KEY) {
  fail(
    `missing ${!URL_ ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'} in env and .env.local`,
    'set both in .env.local at the repo root (git-ignored), or export them in your shell.'
  );
}

try {
  const res = await fetch(`${URL_}/rest/v1/rpc/fn_claude_digest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
    body: '{}',
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    fail(`fn_claude_digest returned HTTP ${res.status}`,
         'check the key is valid and the function still has EXECUTE for service_role.');
  }

  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.constitution) {
    fail('fn_claude_digest returned no constitution text',
         'check documentation.documents has a published row with doc_type=claude_md.');
  }

  console.log(`=== PLATFORM CONTEXT (constitution v${row.version}, updated ${row.updated_at}) ===`);
  console.log(row.constitution);
  console.log('=== END PLATFORM CONTEXT ===');
} catch (err) {
  fail(`request failed: ${err.message}`,
       'check network access to Supabase from this machine.');
}
