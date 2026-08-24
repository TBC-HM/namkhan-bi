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
const BASELINE = {
  "app/api/cron/studio-exports/route.ts": 1,
  "app/api/google/reply/route.ts": 1,
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
  "app/api/marketing/upload-sign/route.ts": 1,
  "app/api/marketing/youtube/disconnect/route.ts": 1,
  "app/api/marketing/youtube/oauth-callback/route.ts": 1,
  "app/api/marketing/youtube/request-video/route.ts": 1,
  "app/api/reputation/scrape-reviews/route.ts": 1,
  "app/api/sales/proposals/[id]/blocks/fill/route.ts": 1,
  "app/api/sop/proposals/generate-one/route.ts": 1,
  "app/finance/_components/TabStrip.tsx": 1,
  "app/finance/pnl/page.tsx": 1,
  "app/h/[property_id]/_components/CeoEntry.tsx": 1,
  "app/h/[property_id]/finance/pnl/_data.ts": 1,
  "app/h/[property_id]/finance/pnl/page.tsx": 2,
  "app/holding/it2/system/data-quality/DqClient.tsx": 1,
  "app/marketing/media/_client/AssetEditDrawer.tsx": 1,
  "app/operations/activities/page.tsx": 1,
  "app/operations/other/page.tsx": 1,
  "app/operations/qa/generate/_components/GenerateSopForm.tsx": 1,
  "app/operations/restaurant/page.tsx": 1,
  "app/operations/retail/page.tsx": 1,
  "app/operations/rooms/page.tsx": 1,
  "app/operations/sops/[sop_code]/edit/_components/SopEditForm.tsx": 1,
  "app/operations/spa/page.tsx": 1,
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
    `tenant-id ratchet holding (${Object.values(counts).reduce((a,b)=>a+b,0)} tracked across ${Object.keys(counts).length} files).`
);
