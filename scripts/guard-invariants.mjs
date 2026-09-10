#!/usr/bin/env node
// scripts/guard-invariants.mjs
// ADR-307/308 (2026-08-24) — INVARIANT CI GATE.
//
// WHY THIS EXISTS. On 2026-08-22 an emergency revert (439979a5) deleted 113
// lines from middleware.ts. Among them was the entire /api exemption block —
// 18 route families accumulated over three months. CI went green, because
// deleting an exemption block is perfectly valid TypeScript and CI only runs
// lint + typecheck + build. The result: Vercel deploy webhooks, /api/health,
// the gmail crons, newsletter refire, sales webhooks and sitemap/robots were
// all 401-dead for two days before anyone noticed, and deploy.deployments
// froze at 2026-08-22 11:39.
//
// The lesson (PBS 2026-08-24): a rule written as prose gets re-read, or not,
// by every new agent. A rule written as a build gate cannot be forgotten.
// Laws L6 and L22 live here now, not only in the constitution.
//
// Same delivery trick as check-it2-orphans.mjs: a GitHub workflow would be the
// obvious home, but the fn_gh_push_file bridge token lacks `workflow` scope
// (403), so this runs as a plain node script wired into the npm build
// (`npm run build` -> prebuild). Every Vercel deploy and every CI build
// enforces it, no matter which door the push came through.
//
// No deps, no network, no DB. Exit 1 on violation.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const violations = [];

// ---------------------------------------------------------------------------
// GUARD 1 — middleware /api exemptions (ADR-306/307)
// Each of these routes validates its OWN secret internally. If middleware
// rejects them before they run, they die silently with a 401.
// ---------------------------------------------------------------------------
const REQUIRED_EXEMPTIONS = [
  '/api/cron',
  '/api/cockpit/webhooks',
  '/api/cockpit/docs/backup',
  '/api/cockpit/health-sweep',
  '/api/health',
  '/api/auth/',
  '/api/marketing/media/preview',
  '/api/marketing/contacts/extract',
  '/api/marketing/gmail/scan-replies',
  '/api/marketing/gmail/extract-shared/',
  '/api/newsletter/refire-broadcasts',
  '/api/public/',
  '/api/sales/leads/webhook',
  '/api/sales/prospects/import',
  '/api/p/',
  '/api/room/',
  '/api/website/sitemap.xml',
  '/api/website/robots.txt',
];

const MW = join(ROOT, 'middleware.ts');
if (!existsSync(MW)) {
  violations.push('middleware.ts is missing entirely.');
} else {
  const mw = readFileSync(MW, 'utf8');

  const missing = REQUIRED_EXEMPTIONS.filter((p) => !mw.includes(`'${p}'`));
  if (missing.length) {
    violations.push(
      `middleware.ts is missing ${missing.length} required /api exemption(s):\n` +
        missing.map((m) => `      - ${m}`).join('\n') +
        `\n    Each of these routes gates itself internally. Without the exemption the\n` +
        `    middleware auth check 401s them before they can present their secret.\n` +
        `    This is exactly what 439979a5 did on 2026-08-22. See ADR-306/307.`
    );
  }

  // Ordering matters as much as presence: the exemption block must run BEFORE
  // the auth client is constructed, otherwise the /api 401 branch pre-empts it.
  const idxExempt = mw.indexOf("pathname.startsWith('/api/cron')");
  const idxClient = mw.indexOf('createServerClient(');
  if (idxExempt !== -1 && idxClient !== -1 && idxExempt > idxClient) {
    violations.push(
      'middleware.ts: the /api exemption block appears AFTER createServerClient().\n' +
        '    It must run first — otherwise the unauthenticated /api/ 401 branch\n' +
        '    returns before the allowlist is ever consulted, and adding paths to\n' +
        '    the list cannot fix it. See ADR-306.'
    );
  }
}

// ---------------------------------------------------------------------------
// GUARD 2 — tenant-id fallback defaults (L22, ADR-300/302) — RATCHET
//
// `?? 260955`, `: number = 260955` and `= 260955)` all silently make an
// unscoped read return Namkhan's data. L22 says scope resolution must fail
// CLOSED; memory 873 says never write COALESCE(p_property_id, 260955) or
// DEFAULT 260955. ADR-300/302 removed 28 of these from SQL — the TypeScript
// side was never swept and still carries 49 across 47 files.
//
// The lookbehind matters: `if (pid === 260955)` is a legitimate COMPARISON
// (e.g. the property->timezone map), not a default. An earlier version of this
// regex matched the tail of `=== 260955)` and would have failed the build on
// correct code. Comparisons are allowed; defaults are not.
//
// Fixing all 49 in one pass is exactly how tenant isolation gets broken:
// L6 warns the legacy unprefixed trees are still the LIVE implementations, so
// a wrong edit makes Donna render Namkhan's data. So this is a RATCHET, not a
// ban: today's count per file is frozen. Any file that gains one fails the
// build. Retire the baseline in small verified batches and lower the numbers.
// ---------------------------------------------------------------------------
const TENANT_DEFAULT_RE = /\?\?\s*(260955|1000001)\b|:\s*number\s*=\s*(260955|1000001)\b|(?<![=!<>])=\s*(260955|1000001)\s*\)/;

// Frozen 2026-08-24. LOWER these numbers as files are fixed; never raise one.
//
// 2026-09-10: four entries lowered to 0 after the guard reported them improved
// and a separate grep confirmed it. They were fixed by other work and the stale
// baseline was quietly holding a door open — an entry of 1 on a clean file lets
// that file silently REGAIN a tenant default without failing the build, which is
// the exact regression this ratchet exists to catch. Lowering tightens; it is the
// only safe direction.
const BASELINE = {
  "app/api/cron/studio-exports/route.ts": 1,
  "app/api/google/reply/route.ts": 0,
  "app/api/marketing/email/refine-block/route.ts": 1,
  "app/api/marketing/media/area-facets/route.ts": 1,
  "app/api/marketing/media/coverage-drill/route.ts": 1,
  "app/api/marketing/media/entity-ref/list/route.ts": 1,
  "app/api/marketing/media/ota-curated-set/route.ts": 1,
  "app/api/marketing/media/ota-proposal/route.ts": 1,
  "app/api/marketing/media/settings/route.ts": 1,
  "app/api/marketing/prospects/scrape/route.ts": 1,
  "app/api/marketing/prospects/stats/route.ts": 1,
  "app/api/marketing/seo/trigger/route.ts": 1,
  "app/api/marketing/upload-sign/route.ts": 0,
  "app/api/marketing/youtube/disconnect/route.ts": 1,
  "app/api/marketing/youtube/oauth-callback/route.ts": 1,
  "app/api/marketing/youtube/request-video/route.ts": 1,
  "app/api/reputation/scrape-reviews/route.ts": 1,
  "app/api/sales/proposals/[id]/blocks/fill/route.ts": 1,
  "app/api/sop/proposals/generate-one/route.ts": 1,
  "app/finance/_components/TabStrip.tsx": 1,
  "app/finance/pnl/page.tsx": 1,
  "app/h/[property_id]/_components/CeoEntry.tsx": 1,
  "app/h/[property_id]/finance/pnl/_data.ts": 0,
  "app/h/[property_id]/finance/pnl/page.tsx": 0,
  "app/holding/it2/system/data-quality/DqClient.tsx": 1,
  "app/marketing/media/_client/AssetEditDrawer.tsx": 1,
  "app/operations/activities/page.tsx": 1,
  "app/operations/other/page.tsx": 1,
  "app/operations/qa/generate/_components/GenerateSopForm.tsx": 1,
  // PBS 2026-08-26: the F&B page was swapped for the cockpit and its previous
  // body moved verbatim to _cockpit/LegacyFbView.tsx. The one tenant default
  // travelled with it — this is a RENAME of the baseline entry, not a raise:
  // page.tsx drops to 0, the legacy view inherits the 1. Still to be fixed.
  "app/operations/restaurant/_cockpit/LegacyFbView.tsx": 1,
  "app/operations/retail/page.tsx": 1,
  "app/operations/rooms/page.tsx": 1,
  "app/operations/sops/[sop_code]/edit/_components/SopEditForm.tsx": 1,
  "app/operations/transport/page.tsx": 1,
  "app/revenue/channels/page.tsx": 1,
  "app/revenue/compset/[comp_id]/page.tsx": 1,
  "app/revenue/lighthouse/_shared/LighthouseShell.tsx": 1,
  "app/revenue/lighthouse/overview/page.tsx": 1,
  "app/revenue/lighthouse/rates/page.tsx": 1,
  "app/revenue/lighthouse/vs-3d/page.tsx": 1,
  "app/revenue/lighthouse/vs-7d/page.tsx": 1,
  "app/revenue/lighthouse/vs-yesterday/page.tsx": 1,
  "lib/cockpit-tools.ts": 1,
  "lib/data-banks-cfo.ts": 2,
  "lib/data-donna-mews.ts": 1,
  "lib/reports/_shared.ts": 1
};

const SCAN_DIRS = ['app', 'lib', 'components'];
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const counts = {};
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const text = readFileSync(file, 'utf8');
    const n = text.split('\n').filter((l) => TENANT_DEFAULT_RE.test(l)).length;
    if (n) counts[rel] = n;
  }
}

const regressions = [];
for (const [rel, n] of Object.entries(counts)) {
  const allowed = BASELINE[rel] ?? 0;
  if (n > allowed) regressions.push(`${rel}: ${allowed} -> ${n}`);
}
if (regressions.length) {
  violations.push(
    `${regressions.length} file(s) GAINED a tenant-id default (L22 — these are bugs):\n` +
      regressions.map((r) => `      - ${r}`).join('\n') +
      `\n    A property scope must never default. Resolve it from the route param or\n` +
      `    useCurrentProperty() and fail CLOSED when absent — a default silently\n` +
      `    serves Namkhan's data to whoever asked, which is a tenant-isolation\n` +
      `    breach, not a cosmetic bug. See L22, ADR-300/302, agent memory 873.`
  );
}

const improved = Object.entries(BASELINE).filter(([rel, n]) => (counts[rel] ?? 0) < n);
if (improved.length) {
  console.log(
    `  note: ${improved.length} file(s) improved since the baseline — lower them in ` +
      `scripts/guard-invariants.mjs so the ratchet keeps its grip:`
  );
  improved.forEach(([rel, n]) => console.log(`    ${rel}: ${n} -> ${counts[rel] ?? 0}`));
}

// ---------------------------------------------------------------------------
// GUARD 3 — HOLDING / TENANT SEPARATION (PBS 2026-09-09)
//
// WHY. Holding (property_id NULL, addressed as 0 in the doc/ingest APIs) and a
// tenant (260955 / 1000001) are different brains — L7 says no cross-brain
// retrieval, ever. Two live leaks got through review because both are
// *absences* rather than wrong code:
//   · app/holding/it/brain redirect()ed to /h/260955/... — a holding page
//     silently depositing the operator in a tenant's tree.
//   · TenantLink had no holding branch, so '/settings' from any /holding/*
//     page fell through to the LEGACY unprefixed settings tree, which is
//     hardcoded to PROPERTY_ID 260955.
//
// WHAT IS NOT A VIOLATION: a holding page LISTING tenants and linking into them
// (portfolio cards, per-property cost splits, "Namkhan photo settings →"). That
// is holding's job, and the operator is choosing. The bug class is a SILENT
// resolution — a redirect, or a nav strip that leaves holding without being
// asked. Only those are gated.
// ---------------------------------------------------------------------------
const HOLDING_DIR = join(ROOT, 'app/holding');
// redirect('/h/260955/...') / redirect(`/h/${x}/...`) inside a holding file
const HOLDING_REDIRECT_RE = /redirect\s*\(\s*[`'"]\/h\//;

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const holdingLeaks = [];
if (existsSync(HOLDING_DIR)) {
  for (const file of walk(HOLDING_DIR)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (isCommentLine(line)) return;
      if (HOLDING_REDIRECT_RE.test(line)) {
        holdingLeaks.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
  }
}
if (holdingLeaks.length) {
  violations.push(
    `${holdingLeaks.length} holding file(s) REDIRECT into a tenant tree (L7 separation):\n` +
      holdingLeaks.map((l) => `      - ${l}`).join('\n') +
      `\n    A holding page may LINK into a tenant the operator picked; it may not\n` +
      `    redirect there. A redirect gives no choice and no signal that the brain\n` +
      `    changed. Send them to a /holding/* destination instead.`
  );
}

// RULE 3a: each settings tab strip must stay inside its own scope. The holding
// strip leaving for /h/<id>/ (or the property strip leaving for /holding/) is
// how an operator crosses the boundary without noticing.
const TAB_CONFIGS = [
  { rel: 'app/holding/settings/_components/tabs.ts', forbidden: /['"`]\/h\/\d+\//, scope: 'holding' },
  { rel: 'lib/property-settings-tabs.ts', forbidden: /['"`]\/holding\//, scope: 'property' },
];
for (const { rel, forbidden, scope } of TAB_CONFIGS) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;
  const bad = readFileSync(abs, 'utf8').split('\n')
    .filter((l) => !isCommentLine(l) && forbidden.test(l));
  if (bad.length) {
    violations.push(
      `${rel} emits a link outside its own (${scope}) scope:\n` +
        bad.map((l) => `      - ${l.trim().slice(0, 100)}`).join('\n') +
        `\n    A settings tab strip must address only its own scope, or the tab bar\n` +
        `    itself becomes the cross-tenant door.`
    );
  }
}

// RULE 3b: the settings write routes are tenant-scoped and MUST verify the
// caller. These four were unauthenticated until 2026-09-09 and one of them
// overwrote every row's property_id with the literal 260955.
const GUARDED_SETTINGS_ROUTES = [
  'app/api/settings/upsert/route.ts',
  'app/api/settings/delete/route.ts',
  'app/api/settings/communications/route.ts',
  'app/api/settings/sales/route.ts',
  'app/api/settings/knowledge/route.ts',
];
const unguarded = GUARDED_SETTINGS_ROUTES.filter((rel) => {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return false;            // route removed — not a violation
  return !readFileSync(abs, 'utf8').includes('requirePropertyAccess');
});
if (unguarded.length) {
  violations.push(
    `${unguarded.length} tenant-scoped settings route(s) lost requirePropertyAccess() (L22):\n` +
      unguarded.map((r) => `      - ${r}`).join('\n') +
      `\n    getSupabaseAdmin() bypasses RLS, so a route that trusts a client-supplied\n` +
      `    property_id lets any authenticated caller write another tenant's settings.`
  );
}

// ---------------------------------------------------------------------------
// GUARD 4 — TENANT-SCOPED BRIDGE READS (PBS 2026-09-09)
//
// WHY. public.v_* bridges are SECURITY DEFINER: they bypass RLS, so the ONLY
// isolation is the .eq('property_id', …) the caller writes (L5). An audit of the
// tenant settings tree found SEVEN reads missing it — the Media page listed both
// tenants' naming conventions, caption rules, alt-text rules and brand palettes
// (a brand bleed L26 forbids), and the Newsletter page listed 23 of Namkhan's
// blocklisted GUEST EMAIL ADDRESSES on Donna's screen (L29, PII).
//
// None of it is a type error, none of it throws, and the page looks fine — you
// only notice if you know how many rows that tenant should have. Hence a gate.
//
// The list below is exactly the views VERIFIED (information_schema, 2026-09-09)
// to carry a property_id column and to be read from a tenant surface. Add a view
// here when you add a tenant-scoped bridge; a view with NO property_id column
// (v_media_tier_thresholds, v_media_channel_specs, v_doc_subtype_vocab, …) is
// genuinely platform-wide and must NOT be listed.
// ---------------------------------------------------------------------------
const TENANT_SCOPED_VIEWS = [
  'v_media_naming_conventions',
  'v_media_caption_rules',
  'v_media_alt_text_rules',
  'v_media_brand_palette',
  'v_marketing_subscriber_blocklist',
  'v_subscriber_groups',
  'v_marketing_import_routing_rules',
];
const TENANT_SURFACE_DIRS = ['app/h'];
const unscopedReads = [];
for (const dir of TENANT_SURFACE_DIRS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const src = readFileSync(file, 'utf8');
    for (const view of TENANT_SCOPED_VIEWS) {
      let idx = src.indexOf(`.from('${view}')`);
      while (idx !== -1) {
        // the statement runs to the next .from( or the end of the call list
        const nxt = src.indexOf(".from('", idx + 7);
        let stmt = src.slice(idx, nxt === -1 ? src.length : nxt);
        for (const stop of ['\n  ]', '\n]', ';\n']) {
          const k = stmt.indexOf(stop);
          if (k !== -1) stmt = stmt.slice(0, k);
        }
        if (!/\.(eq|is|in|or)\(\s*[`'"].*property_id/.test(stmt)) {
          unscopedReads.push(`${rel}:${src.slice(0, idx).split('\n').length}  ${view}`);
        }
        idx = src.indexOf(`.from('${view}')`, idx + 1);
      }
    }
  }
}
if (unscopedReads.length) {
  violations.push(
    `${unscopedReads.length} tenant-scoped bridge read(s) with no property_id filter (L5/L7):\n` +
      unscopedReads.map((r) => `      - ${r}`).join('\n') +
      `\n    These views are SECURITY DEFINER — they bypass RLS and return EVERY\n` +
      `    tenant's rows. Add .eq('property_id', propertyId), or .or(...is.null)\n` +
      `    where platform-wide rows must stay visible. The page will not error\n` +
      `    without it; it will just quietly show another hotel's data.`
  );
}

// ---------------------------------------------------------------------------
if (violations.length) {
  console.error('\n\u001b[31m✖ INVARIANT GATE FAILED\u001b[0m — ' + violations.length + ' violation(s)\n');
  violations.forEach((v, i) => console.error(`  ${i + 1}. ${v}\n`));
  console.error('  These are platform invariants, not style preferences.');
  console.error('  If a change here is genuinely intended, update scripts/guard-invariants.mjs');
  console.error('  in the same commit and say why in the commit message.\n');
  process.exit(1);
}

console.log(
  `✓ invariant gate: ${REQUIRED_EXEMPTIONS.length} middleware exemptions present and correctly ordered; ` +
    `tenant-id ratchet holding (${Object.values(counts).reduce((a,b)=>a+b,0)} tracked across ${Object.keys(counts).length} files); ` +
    `holding/tenant separation clean; ${TENANT_SCOPED_VIEWS.length} tenant-scoped bridges filtered.`
);
