#!/usr/bin/env node
// scripts/check-it2-orphans.mjs
// it-area-reorg-v1 gap 4 (2026-07-30) — NAV LAW CI GATE.
//
// The brief's nav law: "every page.tsx under /holding/it2 must be reachable
// from GROUPS (build fails on orphans)". A GitHub workflow was the obvious
// home, but the fn_gh_push_file bridge token lacks `workflow` scope (403,
// net._http_response 956846), so this runs as a plain node script wired into
// the npm build (`npm run build` → prebuild) — every Vercel deploy enforces it.
//
// Checks:
//   1. ORPHANS — every route under app/holding/it2/**/page.tsx must appear in
//      _lib/groups.ts (group href or sub href) or the explicit allowlist.
//   2. LEGACY LIVENESS — every page.tsx under app/cockpit, app/cockpit-v2 and
//      app/chat must be a redirect stub (contains `redirect(`). A live legacy
//      page = the "one cockpit" law is broken again.
//
// No deps, no network, no DB. Exit 1 on violation.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const IT2_DIR = join(ROOT, 'app', 'holding', 'it2');
const GROUPS_FILE = join(IT2_DIR, '_lib', 'groups.ts');

// Pages reachable by design without a nav tab (linked contextually):
const ALLOWLIST = new Set([
  '/holding/it2',             // Action Center home (group href, kept for safety)
  '/holding/it2/questions',   // Decision Inbox — linked from Action Center Zone 1
  '/holding/it2/system/live', // Live Builders heartbeat — linked contextually from System (ADR-209)
  '/holding/it2/fleet/chat',  // redirect stub — Chat lives in front nav bar (CEO/Sales/Marketing), not IT2 sub-tabs
  // Data surfaces — linked contextually from Knowledge → Data hub (consolidation 2026-07-31):
  '/holding/it2/knowledge/data/schemas',
  '/holding/it2/knowledge/data/freshness',
  '/holding/it2/knowledge/data/sitemap',
  '/holding/it2/knowledge/data/memory',
]);

function walkPages(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkPages(p, out);
    else if (name === 'page.tsx' || name === 'page.ts') out.push(p);
  }
  return out;
}

function routeOf(pageFile, baseDir, basePath) {
  const rel = pageFile.slice(baseDir.length).replace(/\/page\.tsx?$/, '');
  return (basePath + rel).replace(/\/$/, '') || basePath;
}

const errors = [];

// ---- Check 1: IT2 orphans ----
const groupsSrc = readFileSync(GROUPS_FILE, 'utf8');
const navHrefs = new Set([...groupsSrc.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]));

for (const f of walkPages(IT2_DIR)) {
  if (f.includes('/_components/') || f.includes('/_lib/')) continue;
  const route = routeOf(f, IT2_DIR, '/holding/it2');
  // Dynamic segments ([id], [slug]) are detail pages: reachable when the
  // NEAREST static ancestor route is reachable (consolidation pass 2026-07-30;
  // final slice 2026-08-01: walk UP the ancestors — /fleet/team/agent/[role]
  // is reachable via /fleet/team, not via the non-page /fleet/team/agent).
  const reachable = (r) => navHrefs.has(r) || ALLOWLIST.has(r);
  let ok = false;
  if (!route.includes('[')) {
    ok = reachable(route);
  } else {
    let base = route.slice(0, route.indexOf('[')).replace(/\/$/, '');
    while (base.length >= '/holding/it2'.length) {
      if (reachable(base)) { ok = true; break; }
      const cut = base.lastIndexOf('/');
      if (cut <= 0) break;
      base = base.slice(0, cut);
    }
  }
  if (!ok) {
    errors.push(`ORPHAN: ${route} (${f.slice(ROOT.length + 1)}) is not reachable from _lib/groups.ts`);
  }
}

// ---- Check 2: legacy trees must be redirect stubs ----
for (const legacy of ['app/cockpit', 'app/cockpit-v2', 'app/chat']) {
  for (const f of walkPages(join(ROOT, legacy))) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('redirect(')) {
      errors.push(`LIVE LEGACY PAGE: ${f.slice(ROOT.length + 1)} is not a redirect stub — one cockpit = /holding/it2`);
    }
  }
}

if (errors.length) {
  console.error('\n✗ IT2 nav-law check failed:\n');
  for (const e of errors) console.error('  · ' + e);
  console.error('\nFix: add the page to app/holding/it2/_lib/groups.ts (replace or nest —');
  console.error('max 5 groups / 5 sub-tabs), or convert the legacy page to a redirect stub.\n');
  process.exit(1);
}
console.log('✓ IT2 nav-law check passed: no orphans, no live legacy cockpit pages.');
