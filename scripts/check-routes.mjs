#!/usr/bin/env node
// scripts/check-routes.mjs
// brief route_canon_registry-v1 · D1 — ROUTE CANON SCANNER
//
// Generalises scripts/check-it2-orphans.mjs from /holding/it2 to the whole app.
// No deps, no network, no DB. Emits .route-registry.json + a human summary.
//
// Usage:
//   node scripts/check-routes.mjs              summary to stdout
//   node scripts/check-routes.mjs --json       write .route-registry.json
//   node scripts/check-routes.mjs --check      exit 1 on blocking gate violations
//   node scripts/check-routes.mjs --baseline   assert the 585e6aa baseline (dev use)

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');
const ARGS = new Set(process.argv.slice(2));

// ── config ────────────────────────────────────────────────────────────────────

const TENANT_ROOT = join('app', 'h', '[property_id]');

// Property-agnostic surfaces. These legitimately carry no tenant segment and
// must never be redirected into /h/. Keep this list explicit and short.
const PLATFORM_PREFIXES = [
  '/login', '/auth', '/account', '/p/', '/r/', '/room/', '/subscriber/',
  '/legal/', '/tbc', '/sample', '/dev/', '/staging/', '/university',
  '/mail', '/settings/gmail', '/api',
];

// Files that define navigation. A route named here is menu-reachable.
const NAV_FILES = [
  'components/nav/subnavConfig.ts',
  'lib/nav-subgroups.ts',
  'app/holding/it2/_lib/groups.ts',
];
const NAV_GLOBS = [
  { dir: 'lib/dept-cfg', suffix: '.ts' },
  { dir: 'app', name: '_subpages.ts' },
];

const STUB_RE = /<(DeptSubpageStub|FinanceStub|OperationsStub)\b/;
const STUB_IMPORT_RE = /(DeptSubpageStub|FinanceStub|OperationsStub)/;

// ── fs helpers ────────────────────────────────────────────────────────────────

function walk(dir, out = [], opts = {}) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      // Next.js private folders (_foo) are excluded from routing.
      if (opts.skipPrivate && name.startsWith('_')) continue;
      walk(p, out, opts);
    } else if (opts.match ? opts.match(name) : true) {
      out.push(p);
    }
  }
  return out;
}

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ── build the route list ──────────────────────────────────────────────────────

const pageFiles = walk(APP, [], { skipPrivate: true, match: (n) => n === 'page.tsx' || n === 'page.ts' });

function routeOf(file) {
  let r = rel(file).replace(/^app/, '').replace(/\/page\.tsx?$/, '');
  // route groups (foo) do not appear in the URL
  r = r.replace(/\/\([^/]+\)/g, '');
  return r === '' ? '/' : r;
}

function treeOf(route, file) {
  const f = rel(file);
  if (f.startsWith('app/h/[property_id]/')) return 'tenant';
  if (f.startsWith('app/h/')) return 'tenant-malformed';
  if (f.startsWith('app/holding/')) return 'holding';
  if (PLATFORM_PREFIXES.some((p) => route === p.replace(/\/$/, '') || route.startsWith(p))) return 'platform';
  return 'legacy';
}

function tenantRouteOf(route) {
  // '/h/[property_id]/finance/pnl' -> '/finance/pnl'
  return route.replace(/^\/h\/\[property_id\]/, '');
}

// ── per-file analysis ─────────────────────────────────────────────────────────

function analyse(file) {
  const src = read(file);
  const rendersStub = STUB_RE.test(src);
  const importsStub = STUB_IMPORT_RE.test(src);
  const stubReturns = (src.match(/return \(?\s*<(DeptSubpageStub|FinanceStub|OperationsStub)/g) || []).length;
  const jsxReturns  = (src.match(/return \(?\s*</g) || []).length;

  const isStub = rendersStub && stubReturns > 0 && jsxReturns === stubReturns;
  const isRedirectOnly = !rendersStub && /\bredirect\(|\bpermanentRedirect\(/.test(src) && jsxReturns === 0;

  const defects = [];
  // an internal href with no tenant prefix (excludes /h/, /holding/, /api/, externals)
  if (/(href=["'`]|router\.(push|replace)\(["'`]|redirect\(["'`])\/(finance|revenue|marketing|operations|guest|sales|front-office|settings|it|cockpit|overview|today|inbox|knowledge|agents|mail|chat|actions)\b/.test(src)) defects.push('bare_href');
  if (/\b260955\b/.test(src)) defects.push('hardcoded_260955');
  if (/\b1000001\b/.test(src)) defects.push('hardcoded_1000001');
  if (/\bPROPERTY_ID\b/.test(src)) defects.push('imports_PROPERTY_ID');
  if (/NAMKHAN_PROPERTY_ID|===\s*'?260955'?/.test(src) && /\bredirect\(/.test(src)) defects.push('inverted_redirect');
  if (importsStub && !rendersStub) defects.push('dead_stub_import');

  const redirectsToHolding = /\b(permanentRedirect|redirect)\(\s*["'`]\/holding\//.test(src);
  return { isStub, isRedirectOnly, redirectsToHolding, defects };
}

// ── reachability corpus ───────────────────────────────────────────────────────

const navFiles = [
  ...NAV_FILES.map((f) => join(ROOT, f)).filter(existsSync),
  ...walk(join(ROOT, 'lib', 'dept-cfg'), [], { match: (n) => n.endsWith('.ts') }),
  ...walk(APP, [], { match: (n) => n === '_subpages.ts' }),
];
const navBlob = navFiles.map(read).join('\n');

// TRAP 1 (brief D1): the link corpus MUST exclude app/h/** — every stub
// back-references its legacy path via namkhanPath="/x". Including it makes all
// 95 stub-twinned routes look reachable and the dead count reads 9, not 36.
const linkFiles = [
  ...walk(APP, [], { match: (n) => /\.tsx?$/.test(n) }).filter((f) => !rel(f).startsWith('app/h/')),
  ...walk(join(ROOT, 'components'), [], { match: (n) => /\.tsx?$/.test(n) }),
  ...walk(join(ROOT, 'lib'), [], { match: (n) => /\.tsx?$/.test(n) }),
];
const linkIndex = linkFiles.map((f) => ({ f: rel(f), src: read(f) }));

// DB-driven links the scanner cannot see. Refresh with:
//   SELECT href FROM public.v_hod_shortcuts WHERE href LIKE '/%'
//   UNION SELECT landing_page FROM tenancy.holding_users;
const DB_LINKED = [
  '/revenue/channels', '/revenue/compset', '/revenue/parity', '/revenue/pickup-day',
  '/revenue/lighthouse/overview', '/revenue/reports/scheduled/daily/preview',
  '/holding/ceo',
];

function reachability(route) {
  // TRAP 2 (brief D1): strip trailing [param] segments and allow a '/' boundary,
  // because links are built as `/sales/b2b/partner/${id}`.
  const probe = route.replace(/\/\[[^\]]*\].*$/, '');
  const boundary = new RegExp(probe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `(["'\`?/]|$)`);

  if (boundary.test(navBlob)) return 'menu';
  if (DB_LINKED.some((h) => h === probe || h.startsWith(probe + '/'))) return 'linked';
  for (const { f, src } of linkIndex) {
    if (f.startsWith('app' + probe + '/')) continue;   // self-references
    if (boundary.test(src)) return 'linked';
  }
  return 'dead';
}

// ── assemble ──────────────────────────────────────────────────────────────────

const byRoute = new Map();
for (const file of pageFiles) {
  const route = routeOf(file);
  byRoute.set(route, { route, file: rel(file), tree: treeOf(route, file), ...analyse(file) });
}

const tenantTargets = new Set(
  [...byRoute.values()].filter((r) => r.tree === 'tenant').map((r) => tenantRouteOf(r.route))
);

const records = [];
for (const r of byRoute.values()) {
  const rec = {
    route_path: r.route,
    file: r.file,
    tree: r.tree,
    is_stub: r.isStub,
    is_redirect_only: r.isRedirectOnly,
    twin_path: null,
    twin_state: null,
    reachability: null,
    defects: r.defects,
  };
  if (r.tree === 'legacy' && r.isRedirectOnly && r.redirectsToHolding) {
    rec.tree = 'holding-bound';   // superseded surface, already 307s into /holding/*
  } else if (r.tree === 'legacy') {
    const twin = '/h/[property_id]' + r.route;
    rec.twin_path = twin;
    const t = byRoute.get(twin);
    rec.twin_state = !t ? 'missing' : t.isStub ? 'stub' : 'real';
    rec.reachability = reachability(r.route);
  }
  records.push(rec);
}
records.sort((a, b) => a.route_path.localeCompare(b.route_path));

// ── report ────────────────────────────────────────────────────────────────────

const tenant = records.filter((r) => r.tree === 'tenant');
const legacy = records.filter((r) => r.tree === 'legacy');
const holdingBound = records.filter((r) => r.tree === 'holding-bound');
const unported = legacy.filter((r) => r.twin_state !== 'real');
const count = (arr, fn) => arr.filter(fn).length;

const summary = {
  tenant_pages: tenant.length,
  tenant_real: count(tenant, (r) => !r.is_stub && !r.is_redirect_only),
  tenant_stub: count(tenant, (r) => r.is_stub),
  tenant_redirect_only: count(tenant, (r) => r.is_redirect_only),
  legacy_pages: legacy.length,
  legacy_twin_real: count(legacy, (r) => r.twin_state === 'real'),
  legacy_twin_stub: count(legacy, (r) => r.twin_state === 'stub'),
  legacy_twin_missing: count(legacy, (r) => r.twin_state === 'missing'),
  unported: unported.length,
  unported_menu: count(unported, (r) => r.reachability === 'menu'),
  unported_linked: count(unported, (r) => r.reachability === 'linked'),
  unported_dead: count(unported, (r) => r.reachability === 'dead'),
  holding_bound_superseded: holdingBound.length,
  malformed: count(records, (r) => r.tree === 'tenant-malformed'),
};

if (ARGS.has('--json')) {
  writeFileSync(join(ROOT, '.route-registry.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), summary, routes: records }, null, 2));
}

const pad = (k) => (k + ' ').padEnd(26, '.');
console.log('\nROUTE CANON REGISTRY  ·  route_canon_registry-v1\n');
for (const [k, v] of Object.entries(summary)) console.log('  ' + pad(k) + ' ' + v);
console.log('\n  dead (quarantine candidates):');
for (const r of unported.filter((r) => r.reachability === 'dead')) console.log('    ' + r.route_path);

// ── gates ─────────────────────────────────────────────────────────────────────

if (ARGS.has('--check')) {
  const fail = [];
  if (summary.malformed > 0) {
    fail.push(`${summary.malformed} malformed route(s) under app/h (static sibling of [property_id])`);
    for (const r of records.filter((r) => r.tree === 'tenant-malformed')) fail.push('    ' + r.file);
  }
  if (fail.length) { console.error('\nROUTE CANON: FAIL\n  ' + fail.join('\n  ') + '\n'); process.exit(1); }
  console.log('\nROUTE CANON: OK\n');
}
