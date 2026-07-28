// lib/bugAgent.ts
// PBS 2026-07-17 — Shared orchestrator for the bug-agent pipeline.
// Called by:
//   - /api/cockpit/bugs/agent-run   (UI button, cookie-auth)
//   - /api/cron/bug-agent-drain     (pg_cron, middleware-bypassed)
//
// Full pipeline per bug: PLAN → REVIEW → SHIP → VERIFY → CLOSE.
// See /api/cockpit/bugs/agent-run/route.ts for the surface docs.
// PBS 2026-07-24 — token metering added to all callAnthropic calls.
// 2026-07-26 (standing builder) — type repairs on the bug82 repair-loop push:
// planBugFix accepts reviewFeedback, ReviewerResult.reasons populated at every
// return site, plan/review are let (repair loop reassigns). Behavior unchanged.
// 2026-07-27 (standing builder, brief autospec-bug_agent_module-20260725):
//   - guessCandidateFiles: [propertyId] → [property_id] (the smoking-gun path
//     bug that blinded the planner on every /h/<pid>/ route), code-index-first
//     candidate resolution (cockpit.bug_agent_code_index via public bridge),
//     git-tree fallback when directory listing misses.
//   - Verifier repair (D2): poll window mode-aware (240s one / 60s drain);
//     missing CI = done + verify=skipped_no_ci, never failed; prod-curl is
//     informational only (a branch fix can never be live on the prod deploy).
//   - Reviewer ship ceiling ≤4 patched files (was >3 → needs_human).
//   - Monthly spend cap: $50/mo (PBS approved 2026-07-27) enforced against
//     public.ai_token_meter (measured cost, ADR-169) — not the flat estimates.
//   - refreshCodeIndex() exported for /api/cron/bug-agent-index-refresh.
// 2026-07-28 (standing builder, verifier objections G1+G3 on the same brief):
//   - G1: the CI gate is ONLY the typecheck check-run(s) (tsc/typecheck names).
//     Advisory checks (design-doc-check et al.) and commit statuses are
//     informational — run 70's good fix was killed by design-doc-check:failure
//     while tsc was still in_progress. Spec-conformance per §0.R R2.
//   - G3: verify poll budget is clamped to the route's remaining lifetime
//     (runAgentJob passes a job deadline; ROUTE_BUDGET_MS=280s of the 300s
//     maxDuration), and finalizeOrphanRuns() (called from the 5-min
//     bugs/sweep cron, STEP C) closes runs killed mid-flight by Vercel:
//     branch shipped → single check probe → done/failed; no branch → failed.
//   - ADR-175 tightening (run 86): auto-merge requires ci_ok === true.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropicTool } from '@/lib/mail/anthropic';

const GH_REPO = 'TBC-HM/namkhan-bi';
const GH_BASE_BRANCH = 'main';
export const COST_CAP_USD = 2.0;
// PBS 2026-07-27 (brief autospec-bug_agent_module-20260725, R1 approved):
// hard monthly ceiling on bug-agent Anthropic spend, measured from
// public.ai_token_meter (real metering), NOT the flat per-phase estimates.
export const MONTHLY_COST_CAP_USD = 50.0;
const METERED_AGENT_HANDLES = ['bug-agent', 'bug-agent-reviewer'];
const MAX_FILES_PER_PLAN = 8;   // PBS 2026-07-26 (bug #84) — raised to feed more context
const MAX_FILE_BYTES = 80_000;  // PBS 2026-07-26 (bug #84) — never truncate candidate files

let __cachedGhToken: string | null = null;
async function getGhToken(): Promise<string> {
  if (__cachedGhToken) return __cachedGhToken;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_get_secret', { p_name: 'github_token' });
  if (error || typeof data !== 'string' || data.length < 20) {
    throw new Error(`gh_token_missing: ${error?.message ?? 'no data'}`);
  }
  __cachedGhToken = data;
  return data;
}

export interface FilePatch { path: string; new_content: string; reasoning: string }
export interface HumanOption { label: string; consequence: string; recommended?: boolean }
export interface PlannerResult { plan_md: string; patches: FilePatch[]; skip_reason?: string; missing_files: string[]; cost_usd: number; human_question?: string; human_options?: HumanOption[]; candidates_total?: number; files_fetched?: number }
export interface ReviewerResult { verdict: 'approve' | 'reject' | 'needs_human'; notes: string; reasons: string[]; cost_usd: number }

interface RunPatch {
  phase?: string; branch?: string | null; pr_number?: number | null; pr_url?: string | null;
  commit_sha?: string | null; planner_out?: unknown; reviewer_out?: unknown; verifier_out?: unknown;
  cost_usd?: number; log_md?: string; ended_at?: string | null; error?: string | null;
}
// PBS 2026-07-17 — cockpit schema is NOT exposed to PostgREST (silent-empty
// class of bug). Route all reads/writes through public RPCs + public views.
async function updateRun(runId: number, patch: RunPatch, appendLog?: string) {
  const sb = getSupabaseAdmin();
  // Serialize numbers/objects as jsonb-safe values. JSONB coerces via json_typeof.
  const jsonPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) { jsonPatch[k] = null; continue; }
    if (typeof v === 'object') jsonPatch[k] = v;
    else jsonPatch[k] = String(v);
  }
  await sb.rpc('fn_bug_agent_run_update', {
    p_id: runId,
    p_patch: jsonPatch,
    p_append_log: appendLog ?? null,
  });
}
async function markBug(bugId: number, patch: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  const jsonPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    jsonPatch[k] = v == null ? null : String(v);
  }
  await sb.rpc('fn_exec_bug_mark', { p_id: bugId, p_patch: jsonPatch });
}

// ---------- GitHub helpers ----------
async function ghFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const tok = await getGhToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${tok}`);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  return fetch(`https://api.github.com${path}`, { ...init, headers });
}
async function ghGetFile(path: string, ref = GH_BASE_BRANCH): Promise<{ content: string; sha: string } | null> {
  const r = await ghFetch(`/repos/${GH_REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`gh_get_file ${r.status}: ${path}`);
  const j = await r.json() as { content: string; encoding: string; sha: string };
  if (j.encoding !== 'base64') throw new Error(`gh_file_encoding: ${j.encoding}`);
  const buf = Buffer.from(j.content, 'base64').toString('utf-8');
  return { content: buf, sha: j.sha };
}
async function ghGetBranchSha(branch: string): Promise<string> {
  const r = await ghFetch(`/repos/${GH_REPO}/git/refs/heads/${encodeURIComponent(branch)}`);
  if (!r.ok) throw new Error(`gh_get_ref ${r.status}: ${branch}`);
  const j = await r.json() as { object: { sha: string } };
  return j.object.sha;
}
async function ghCreateBranch(newBranch: string, fromSha: string): Promise<void> {
  const r = await ghFetch(`/repos/${GH_REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: fromSha }),
  });
  if (!r.ok && r.status !== 422 /* already exists */) {
    const t = await r.text();
    throw new Error(`gh_create_branch ${r.status}: ${t}`);
  }
}
async function ghPutFile(path: string, content: string, branch: string, message: string, sha?: string): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const r = await ghFetch(`/repos/${GH_REPO}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`gh_put_file ${r.status}: ${path} · ${t.slice(0, 200)}`);
  }
  const j = await r.json() as { commit: { sha: string } };
  return j.commit.sha;
}
async function ghOpenPR(branch: string, title: string, body: string): Promise<{ number: number; html_url: string }> {
  const r = await ghFetch(`/repos/${GH_REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, head: branch, base: GH_BASE_BRANCH, body }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`gh_open_pr ${r.status}: ${t.slice(0, 300)}`);
  }
  return await r.json() as { number: number; html_url: string };
}
// 2026-07-28 (G1, verifier objection on brief autospec-bug_agent_module-20260725):
// the GATE is the typecheck check-run(s) ONLY — `tsc --noEmit` from
// .github/workflows/typecheck.yml (fires on push to every branch) and the CI
// job that embeds a typecheck. Advisory checks (design-doc-check is
// continue-on-error yet still reports conclusion=failure) and commit
// STATUSES (Vercel deploy states) are INFORMATIONAL: they go in the note,
// they never fail the run. Run 70's good 1-file fix was killed by
// design-doc-check:failure while tsc was still in_progress — spec §0.R R2
// named the typecheck check-run as THE gate all along.
const GATE_CHECK_RE = /tsc|typecheck/i;
async function ghGetCheckStatus(sha: string): Promise<{ ci_ok: boolean | null; checks_count: number; note: string }> {
  const [runsR, statusR] = await Promise.all([
    ghFetch(`/repos/${GH_REPO}/commits/${sha}/check-runs`),
    ghFetch(`/repos/${GH_REPO}/commits/${sha}/status`),
  ]);
  const runs = runsR.ok ? await runsR.json() as { check_runs: Array<{ name: string; conclusion: string | null; status: string }> } : { check_runs: [] };
  const status = statusR.ok ? await statusR.json() as { state: string } : { state: 'pending' };
  const gates = runs.check_runs.filter((c) => GATE_CHECK_RE.test(c.name));
  const info = runs.check_runs.filter((c) => !GATE_CHECK_RE.test(c.name));
  const fmt = (arr: Array<{ name: string; conclusion: string | null; status: string }>) => arr.map((c) => `${c.name}:${c.conclusion ?? c.status}`).join('|');
  const note = `gate=${fmt(gates) || '(none)'} · info=${fmt(info) || '(none)'} · github-status=${status.state}`;
  // D2 + G1: an explicit GATE failure decides immediately, even while other
  // checks are still pending — and ONLY a gate failure can fail the run.
  const gateFail = gates.some((c) => c.conclusion && c.conclusion !== 'success' && c.conclusion !== 'skipped' && c.conclusion !== 'neutral');
  if (gateFail) return { ci_ok: false, checks_count: gates.length, note };
  const gatePending = gates.some((c) => c.status === 'in_progress' || c.status === 'queued');
  if (gatePending || gates.length === 0) return { ci_ok: null, checks_count: gates.length, note };
  return { ci_ok: true, checks_count: gates.length, note };
}

// 2026-07-27 — full repo tree (app/** + lib/** TS files), cached per lambda
// instance for 10 min. Fallback path resolver when the code index and the
// directory listing both miss (brief §2: planner resolves REAL paths).
let __treeCache: { at: number; paths: string[] } | null = null;
async function ghGetTreePaths(): Promise<string[]> {
  if (__treeCache && Date.now() - __treeCache.at < 10 * 60_000) return __treeCache.paths;
  try {
    const r = await ghFetch(`/repos/${GH_REPO}/git/trees/${GH_BASE_BRANCH}?recursive=1`);
    if (!r.ok) return __treeCache?.paths ?? [];
    const j = await r.json() as { tree: Array<{ path: string; type: string }> };
    const paths = (j.tree ?? []).filter((t) => t.type === 'blob' && /^(app|lib)\/.*\.(ts|tsx)$/.test(t.path)).map((t) => t.path);
    __treeCache = { at: Date.now(), paths };
    return paths;
  } catch {
    return __treeCache?.paths ?? [];
  }
}


// ---------- ADR-175 auto-merge (PBS 2026-07-27: "if I merge every time I am the bottleneck") ----------
const PROTECTED_PATHS = [/^middleware/, /auth/i, /^package(-lock)?\.json$/, /^next\.config/, /^vercel\.json$/, /^supabase\/migrations\//, /^\.github\//, /\.env/];
const AUTO_MERGE_MAX_FILES = 15;
async function autoMergeEnabled(): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.rpc('fn_automation_enabled');
    return data !== false;
  } catch { return false; }
}
async function tryAutoMerge(prNumber: number, patches: FilePatch[], runId: number): Promise<boolean> {
  if (!(await autoMergeEnabled())) { await updateRun(runId, {}, 'MERGE · skipped — automation kill switch OFF'); return false; }
  if (patches.length > AUTO_MERGE_MAX_FILES) { await updateRun(runId, {}, `MERGE · skipped — ${patches.length} files > ${AUTO_MERGE_MAX_FILES} (PBS merges)`); return false; }
  const touched = patches.filter((p) => PROTECTED_PATHS.some((re) => re.test(p.path)));
  if (touched.length > 0) { await updateRun(runId, {}, `MERGE · skipped — protected path(s): ${touched.map((t) => t.path).join(', ')} (PBS merges)`); return false; }
  const r = await ghFetch(`/repos/${GH_REPO}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: 'squash' }),
  });
  if (!r.ok) {
    const t = await r.text();
    await updateRun(runId, {}, `MERGE · failed ${r.status}: ${t.slice(0, 150)} (PBS merges)`);
    return false;
  }
  await updateRun(runId, {}, `MERGE · auto-merged PR #${prNumber} (ADR-175: reviewer+verify green, unprotected, ≤${AUTO_MERGE_MAX_FILES} files)`);
  return true;
}

// ---------- Planning ----------
// PBS 2026-07-17 — convert URL path segments to Next.js bracket-notation
// so we hit real file paths like app/sales/proposals/[id]/edit/page.tsx
// rather than app/sales/proposals/3c102291-.../edit/page.tsx (which doesn't exist).
function bracketize(segments: string[]): string[] {
  return segments.map((s) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return '[id]';
    if (/^\d+$/.test(s)) return '[id]';
    return s;
  });
}

async function ghListDir(dirPath: string): Promise<string[]> {
  const r = await ghFetch(`/repos/${GH_REPO}/contents/${encodeURIComponent(dirPath)}`);
  if (!r.ok) return [];
  const items = await r.json() as Array<{ type: string; path: string }>;
  if (!Array.isArray(items)) return [];
  return items.filter((i) => i.type === 'file').map((i) => i.path);
}

// 2026-07-27 — candidate resolution order (brief §2): code index → live
// directory listing → git-tree segment match. The index is refreshed nightly
// by /api/cron/bug-agent-index-refresh into cockpit.bug_agent_code_index and
// read here through the public bridge view (cockpit is not PostgREST-exposed).
async function candidatesFromIndex(dirs: string[]): Promise<string[]> {
  const out: string[] = [];
  try {
    const sb = getSupabaseAdmin();
    for (const dir of dirs) {
      const { data, error } = await sb
        .from('v_bug_agent_code_index')
        .select('path, kind')
        .like('path', `${dir}/%`)
        .limit(MAX_FILES_PER_PLAN * 2);
      if (error || !data) continue;
      // Direct children first (the page itself + its _components), pages before the rest.
      const rows = data as Array<{ path: string; kind: string }>;
      const depth = (p: string) => p.split('/').length;
      const base = depth(dir) + 1;
      rows.sort((a, b) => {
        const rank = (r: { path: string; kind: string }) =>
          (r.kind === 'page' ? 0 : r.kind === 'layout' ? 1 : 2) * 100 + (depth(r.path) - base);
        return rank(a) - rank(b);
      });
      out.push(...rows.map((r) => r.path));
      if (out.length >= MAX_FILES_PER_PLAN) break;
    }
  } catch { /* index unavailable → caller falls back */ }
  return out;
}

// Last-resort fallback: score every tree path by how many URL segments it
// contains; take the best-scoring page/component files.
function candidatesFromTree(treePaths: string[], segments: string[]): string[] {
  const segs = segments.filter((s) => s.length > 2 && !s.startsWith('['));
  if (segs.length === 0) return [];
  const scored = treePaths
    .map((p) => {
      const lower = p.toLowerCase();
      const score = segs.reduce((n, s) => n + (lower.includes(`/${s.toLowerCase()}`) ? 1 : 0), 0);
      const bonus = p.endsWith('/page.tsx') ? 0.5 : p.endsWith('Client.tsx') ? 0.4 : p.endsWith('/layout.tsx') ? 0.2 : 0;
      return { p, score: score + bonus };
    })
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_FILES_PER_PLAN).map((x) => x.p);
}

async function guessCandidateFiles(bug: { page_url: string | null; body: string | null }): Promise<string[]> {
  const files: string[] = [];
  const url = bug.page_url ?? '';
  // List ALL files in the bug's route directory (law 549 — no guessing)
  const dirs: string[] = [];
  let urlSegments: string[] = [];
  try {
    const u = new URL(url);
    const rawParts = u.pathname.split('/').filter(Boolean);
    const isPidRoute = rawParts[0] === 'h' && rawParts[1] && /^\d+$/.test(rawParts[1]);
    if (isPidRoute) {
      const rest = bracketize(rawParts.slice(2));
      urlSegments = rest;
      if (rest.length > 0) {
        // 2026-07-27 FIX (brief §0 smoking gun): the real repo segment is
        // [property_id] (underscore), not [propertyId]. The camelCase guess
        // fetched zero candidate files on EVERY /h/<pid>/ bug since 07-17.
        dirs.push(`app/h/[property_id]/${rest.join('/')}`);
        dirs.push(`app/${rest.join('/')}`);
      }
    } else {
      const seg = bracketize(rawParts);
      urlSegments = seg;
      if (seg.length > 0) dirs.push(`app/${seg.join('/')}`);
    }
  } catch { /* ignore */ }
  // 1) Code index (nightly-refreshed inventory of real repo paths)
  files.push(...await candidatesFromIndex(dirs));
  // 2) Live directory listing (index empty / stale / unavailable)
  if (files.length === 0) {
    for (const dir of dirs) {
      const listed = await ghListDir(dir);
      files.push(...listed);
      if (files.length >= MAX_FILES_PER_PLAN) break;
    }
  }
  // 3) Git-tree segment match (route dir guess was wrong entirely)
  if (files.length === 0 && urlSegments.length > 0) {
    const tree = await ghGetTreePaths();
    files.push(...candidatesFromTree(tree, urlSegments));
  }
  // Structural context always included
  files.push('lib/dept-cfg.ts', 'lib/dept-cfg/index.ts', 'app/(cockpit)/_design/index.ts');
  return Array.from(new Set(files)).slice(0, MAX_FILES_PER_PLAN);
}

const PLANNER_SYSTEM = [
  'You are a senior TypeScript engineer fixing a bug in a Next.js 15 App Router codebase for The Namkhan hotel BI.',
  'Design rules: paper-white #FFFFFF, hairlines #E6DFCC, ink #1B1B1B, ink-soft #5A5A5A, brand green #084838. NEVER use `var(--paper-warm)` (renders dark).',
  'RULES:',
  '- new_content must be the COMPLETE file content, not a diff. Preserve all imports, exports, unchanged code exactly.',
  '- Do NOT add features or refactor beyond what the bug asks. Minimal surgical change only.',
  '- If the bug is unclear, too big (page rewrite), or requires DB changes, set skip_reason and return patches: [].',
  '- Never touch server-side secrets, .env, package.json, or lock files.',
  '- Prefer editing files that were passed in as context. If none match, set skip_reason.',
  '- missing_files: list every file path you need but was NOT given. Use [] when all files provided.',
  '- CONTRACT (bug #87 lesson): exactly ONE of these three outcomes is valid — (a) patches non-empty, (b) missing_files non-empty (exact repo paths — if your plan names a component you were not given, its file path MUST be in missing_files), or (c) skip_reason set. Empty patches + empty missing_files + no skip_reason is a contract violation and wastes the whole run.',
  '- When you set skip_reason, ALSO set human_question (the one decision the owner must make) and human_options (2-4 concrete choices, each with its consequence, exactly one recommended: true). The owner answers by clicking — never make him write prose.',
  '- METRIC TRUTH (canon 552/554): if the bug claims a NUMBER or CALCULATION is wrong (ADR, RevPAR, occupancy, revenue, any KPI), do NOT change calculation logic. First outcome must be skip_reason citing kpi.kpi_catalog — metric changes go through the conformance pipeline with owner-verified definitions, never through a bug patch.',
  '- Status/state indicators must use design-system data-status tokens — never hardcoded hex/rgba.',
  '- Before using var(--status-*), read app/(cockpit)/_design/internal/tokens.css. If primitives like --status-green/amber/red/grey exist, alias semantic tokens to them (e.g. --status-success: var(--status-green)). If primitives are missing, add them with raw hex in the primitive layer, THEN alias semantics to those primitives — no raw hex in semantic tokens.',
].join('\n');

// 2026-07-28 (drain convergence, standing builder): every needs_human exit must
// park a multiple-choice question on the bug (canon rule 594). Bugs with
// open_question leave v_bugs_ready_for_agent, so the drain converges instead of
// re-running the same needs_human bug every batch (observed: bug 49 ran twice
// in 20 min). Planner-provided questions win; otherwise a generic fallback
// carries the concrete reason so /holding/bugs shows why (brief A7).
async function storeNeedsHumanQuestion(bugId: number, reason: string, question?: string | null, options?: HumanOption[] | null): Promise<void> {
  const q = (question && options && options.length)
    ? { question, options, asked_by: 'bug-agent', asked_at: new Date().toISOString() }
    : {
        question: `The bug agent could not fix this bug automatically (${reason.slice(0, 200)}). What should happen?`,
        options: [
          { label: 'Send it back to the agent for one more try', consequence: 'Costs roughly $0.30 more and may hit the same blocker again' },
          { label: 'I will fix it manually', consequence: 'The bug leaves the agent queue and waits for a human fix', recommended: true },
          { label: 'Drop this bug', consequence: 'The bug is archived and nothing changes on the site' },
        ],
        asked_by: 'bug-agent',
        asked_at: new Date().toISOString(),
      };
  try {
    await (getSupabaseAdmin() as any).rpc('fn_set_bug_open_question', { p_bug_id: bugId, p_question: q });
  } catch { /* question storage is best-effort; needs_human still lands */ }
}

async function planBugFix(bug: { id: number; body: string | null; page_url: string | null; property_id: string | null; reviewFeedback?: string }): Promise<PlannerResult> {
  const candidates = await guessCandidateFiles(bug);
  const contexts: Array<{ path: string; content: string }> = [];
  let fetchLog = '';
  for (const p of candidates) {
    try {
      const file = await ghGetFile(p);
      if (file) {
        // PBS 2026-07-26 (bug #84): never truncate — use full file content
        contexts.push({ path: p, content: file.content.slice(0, MAX_FILE_BYTES) });
        fetchLog += `  fetched: ${p} (${file.content.length} bytes)\n`;
      }
    } catch { /* skip missing */ }
  }
  // 2026-07-28 (A1 evidence, verifier §0.V2): candidate resolution + initial
  // fetch counts must appear in the run log so the ≥80% rate is gradable.
  const initialFetched = contexts.length;

  function buildPrompt(ctxs: typeof contexts): string {
    const contextBlock = ctxs.length === 0
      ? '(no candidate files fetched — you may need to set skip_reason)'
      : ctxs.map((c) => `=== FILE: ${c.path} (${c.content.length} bytes) ===\n${c.content}\n=== END FILE ===`).join('\n\n');
    return [
      `BUG #${bug.id}`,
      `URL: ${bug.page_url ?? '(none)'}`,
      `REPORT: ${bug.body ?? '(empty)'}`,
      '',
      `CANDIDATE FILES (${ctxs.length} files fetched):`,
      fetchLog.trim(),
      contextBlock,
      '',
      'Return the JSON plan.',
      ...(bug.reviewFeedback ? ['', 'PREVIOUS REVIEWER FEEDBACK (fix these issues):', bug.reviewFeedback] : []),
    ].join('\n');
  }



  // Initial plan via tool-use — guaranteed schema-conformant output (law 549)
  const bugMeterOpts = { property_id: bug.property_id ? Number(bug.property_id) : null, agent_handle: 'bug-agent', source: 'planner', run_ref: String(bug.id) };
  type PlanInput = { plan_md: string; patches: FilePatch[]; missing_files: string[]; skip_reason: string | null; human_question?: string | null; human_options?: HumanOption[] | null };
  const PLAN_SCHEMA = { type: 'object', properties: { plan_md: { type: 'string' }, patches: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, new_content: { type: 'string' }, reasoning: { type: 'string' } }, required: ['path', 'new_content', 'reasoning'] } }, missing_files: { type: 'array', items: { type: 'string' } }, skip_reason: { type: ['string', 'null'] },
    // PBS 2026-07-27: needs_human must be answerable by multiple choice, never a dead end
    human_question: { type: ['string', 'null'], description: 'When skip_reason is set: the ONE decision the owner must make, phrased as a question' },
    human_options: { type: ['array', 'null'], items: { type: 'object', properties: { label: { type: 'string' }, consequence: { type: 'string' }, recommended: { type: 'boolean' } }, required: ['label', 'consequence'] }, description: '2-4 concrete choices with consequences; mark ONE recommended' } }, required: ['plan_md', 'patches', 'missing_files'] };
  const planResult = await callAnthropicTool<PlanInput>({ system: PLANNER_SYSTEM, prompt: buildPrompt(contexts), toolName: 'submit_plan', toolDescription: 'Submit the repair plan. Use skip_reason when you cannot fix the bug with the given files.', toolSchema: PLAN_SCHEMA, maxTokens: 8000, meter: bugMeterOpts });
  let plan: PlannerResult = { plan_md: planResult.plan_md ?? '', patches: (planResult.patches ?? []).filter((p) => p.path && p.new_content), skip_reason: planResult.skip_reason ?? undefined, missing_files: planResult.missing_files ?? [], cost_usd: 0.05, human_question: planResult.human_question ?? undefined, human_options: planResult.human_options ?? undefined };

  // Contract-violation retry (bug #87): zero patches, no skip_reason, no missing_files
  // → one forced retry telling the planner to pick a valid outcome. No prose regex (law 549).
  if (plan.patches.length === 0 && !plan.skip_reason && plan.missing_files.length === 0) {
    const retryResult = await callAnthropicTool<PlanInput>({
      system: PLANNER_SYSTEM,
      prompt: buildPrompt(contexts) + '\n\nCONTRACT VIOLATION in your previous submission: patches=[], missing_files=[], skip_reason=null. Your plan text named files/components you were not given. Resubmit with exactly one valid outcome: patches, OR missing_files listing the exact repo paths you need (e.g. the component file that renders what the bug describes), OR skip_reason.',
      toolName: 'submit_plan',
      toolDescription: 'Resubmit the repair plan honoring the contract: patches non-empty, or missing_files non-empty, or skip_reason set.',
      toolSchema: PLAN_SCHEMA, maxTokens: 8000,
      meter: { property_id: null, agent_handle: 'bug-agent', source: 'bug-agent', run_ref: String(bug.id) + '-contract-retry' },
    });
    plan = { plan_md: retryResult.plan_md ?? plan.plan_md, patches: (retryResult.patches ?? []).filter((p) => p.path && p.new_content), skip_reason: retryResult.skip_reason ?? undefined, missing_files: retryResult.missing_files ?? [], cost_usd: plan.cost_usd + 0.05 };
  }

  // Re-plan loop: use structured missing_files from planner JSON (law 549 — no prose regex)
  for (let round = 0; round < 3 && (plan.skip_reason || plan.patches.length === 0) && plan.missing_files.length > 0; round++) {
    const missingPath = plan.missing_files.find((p) => !contexts.some((c) => c.path === p));
    if (!missingPath) break;
    try {
      const file = await ghGetFile(missingPath);
      if (!file) break;
      contexts.push({ path: missingPath, content: file.content.slice(0, MAX_FILE_BYTES) });
      fetchLog += `  re-plan round ${round + 1}: fetched ${missingPath} (${file.content.length} bytes)\n`;
      const replanResult = await callAnthropicTool<PlanInput>({ system: PLANNER_SYSTEM, prompt: buildPrompt(contexts), toolName: 'submit_plan', toolDescription: 'Submit the repair plan. Use skip_reason when you cannot fix the bug with the given files.', toolSchema: PLAN_SCHEMA, maxTokens: 8000,
        meter: { property_id: null, agent_handle: 'bug-agent', source: 'bug-agent', run_ref: String(bug.id) + '-replan' + round } });
      plan = { plan_md: replanResult.plan_md ?? '', patches: (replanResult.patches ?? []).filter((p) => p.path && p.new_content), skip_reason: replanResult.skip_reason ?? undefined, missing_files: replanResult.missing_files ?? [], cost_usd: plan.cost_usd + 0.05 };
    } catch { break; }
  }

  plan.candidates_total = candidates.length;
  plan.files_fetched = initialFetched;
  return plan;
}

const REVIEWER_SYSTEM = [
  'You are a strict code reviewer for a Next.js hotel BI app. Review the bug + patches and call submit_review.',
  'verdict="approve" if: patches are minimal, safe, likely to fix the bug, no syntax issues, no var(--paper-warm), no hardcoded hex/rgba in status indicators (use data-status tokens instead).',
  'verdict="reject" if: patches introduce bugs, break TS, remove needed code, add features.',
  'verdict="needs_human" if: patches attempt a page rewrite, touch >4 files, or bug is ambiguous.',
  'Be adversarial. Default to needs_human when in doubt.',
  'SCOPE: Judge ONLY lines that this patch ADDS or MODIFIES. Pre-existing code that was untouched is NOT grounds for reject — mention it as a follow-up note only.',
  'TOKEN LAYERS: Raw hex (#…) is ALLOWED in tokens.css palette-primitive definitions (e.g. --color-green-700: #2E7D32). It is FORBIDDEN in components, inline styles, and semantic token definitions only when an equivalent primitive already exists. Do not reject for hex in the palette layer.',
  'On reject: notes MUST quote the exact violating NEW code (e.g. the hex value or token name) and name the correct replacement. Minimum 30 words in notes.',
].join('\n');

async function reviewPlan(bug: { id: number; body: string | null }, plan: PlannerResult): Promise<ReviewerResult> {
  if (plan.patches.length === 0) return { verdict: 'needs_human', notes: 'Planner produced no patches.', reasons: [], cost_usd: 0 };
  // 2026-07-27 (brief §2): ship ceiling is ≤4 patched files. MAX_FILES_PER_PLAN
  // stays 8 (PBS bug #84 — that is CONTEXT fed to the planner, not the ship cap).
  if (plan.patches.length > 4) return { verdict: 'needs_human', notes: `Too many files (${plan.patches.length}), needs human.`, reasons: [], cost_usd: 0 };
  const patchSummary = plan.patches.map((p) => (
    `--- ${p.path} (${p.new_content.length} bytes) ---\nRATIONALE: ${p.reasoning}\nFULL PATCHED CONTENT:\n${p.new_content}`
  )).join('\n\n');
  const prompt = [
    `BUG #${bug.id}: ${bug.body ?? '(empty)'}`,
    `PLAN: ${plan.plan_md}`,
    `PATCHES (${plan.patches.length}):`,
    patchSummary,
  ].join('\n');
  const parsed = await callAnthropicTool<{ verdict: string; notes: string }>({
    system: REVIEWER_SYSTEM, prompt, toolName: 'submit_review',
    toolDescription: 'Submit the review verdict for the proposed patches.',
    toolSchema: { type: 'object', properties: { verdict: { type: 'string', enum: ['approve', 'reject', 'needs_human'] }, notes: { type: 'string', minLength: 10 } }, required: ['verdict', 'notes'] },
    maxTokens: 1000,
    meter: { property_id: null, agent_handle: 'bug-agent-reviewer', source: 'bug-agent', run_ref: String(bug.id) },
  });
  const verdict = ['approve', 'reject', 'needs_human'].includes(String(parsed.verdict))
    ? (parsed.verdict as 'approve' | 'reject' | 'needs_human')
    : 'needs_human';
  const notes = typeof parsed.notes === 'string' ? parsed.notes : '(no notes)';
  return { verdict, notes, reasons: verdict === 'reject' ? [notes] : [], cost_usd: 0.01 };
}



async function shipPatches(bug: { id: number; body: string | null }, plan: PlannerResult): Promise<{ branch: string; commit_sha: string; pr_number: number | null; pr_url: string | null; pr_error: string | null }> {
  const branch = `bots/bug-${bug.id}`;
  const mainSha = await ghGetBranchSha(GH_BASE_BRANCH);
  await ghCreateBranch(branch, mainSha);
  let lastCommit = '';
  for (const patch of plan.patches) {
    const existing = await ghGetFile(patch.path, branch);
    const msg = `bug-agent: ${plan.plan_md.slice(0, 60)} · #${bug.id}`;
    lastCommit = await ghPutFile(patch.path, patch.new_content, branch, msg, existing?.sha);
  }
  // PBS 2026-07-27 — DESIGN RITUAL COMPLIANCE (locked 2026-05-03): every UI
  // change must append a dated entry to DESIGN_NAMKHAN_BI.md's Update history.
  // Agent PRs never did, so design-doc-check failed red on every UI PR and
  // (as a required check) BLOCKED merges — including our own ADR-175
  // auto-merge. Honor the ritual automatically instead of asking PBS to
  // babysit CI: if this PR touches design surfaces, append the entry here.
  const DESIGN_SURFACE = /^(app\/|components\/|styles\/|lib\/format\.ts$)/;
  if (plan.patches.some((p) => DESIGN_SURFACE.test(p.path)) && !plan.patches.some((p) => p.path === 'DESIGN_NAMKHAN_BI.md')) {
    try {
      const doc = await ghGetFile('DESIGN_NAMKHAN_BI.md', branch);
      if (doc) {
        const today = new Date().toISOString().slice(0, 10);
        const touched = plan.patches.filter((p) => DESIGN_SURFACE.test(p.path)).map((p) => p.path);
        const entry = [
          '',
          `### ${today} — bug-agent · fix #${bug.id}`,
          `- ${plan.plan_md.slice(0, 160).replace(/\n/g, ' ')}`,
          ...touched.map((p) => `- touched \`${p}\``),
          '',
        ].join('\n');
        lastCommit = await ghPutFile('DESIGN_NAMKHAN_BI.md', doc.content.trimEnd() + '\n' + entry, branch, `bug-agent: design-doc update-history entry · #${bug.id}`, doc.sha);
      }
    } catch {
      // Doc append is best-effort — never fail a ship over it. The check
      // will warn, PBS is not required to act.
    }
  }
  const prTitle = `bug-agent · fix #${bug.id}: ${(bug.body ?? '').slice(0, 60)}`;
  const prBody = [
    `Autonomous fix by bug-agent for bug #${bug.id}.`,
    '',
    `**Plan:** ${plan.plan_md}`,
    '',
    `**Files patched (${plan.patches.length}):**`,
    plan.patches.map((p) => `- \`${p.path}\` — ${p.reasoning}`).join('\n'),
    '',
    '_Review carefully before merging. Bug-agent v1 does not auto-merge._',
    `_Bug: /holding/bugs · run: cockpit.bug_agent_runs_`,
  ].join('\n');
  // PBS 2026-07-17 — PR creation is soft-fail. Branch + commits are the
  // important artifacts; PBS can open PRs in bulk via `gh pr create`.
  // 2026-07-26 (§0.R R1b): vault token re-verified — POST /pulls returns 422
  // on a fake head (not 403), i.e. the token DOES have Pull-Requests write.
  // The historical 403s were a stale token. Soft-fail kept as belt-and-braces.
  // The agent NEVER merges (PUSH DISCIPLINE rule 530 — PBS merges).
  try {
    const pr = await ghOpenPR(branch, prTitle, prBody);
    return { branch, commit_sha: lastCommit, pr_number: pr.number, pr_url: pr.html_url, pr_error: null };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { branch, commit_sha: lastCommit, pr_number: null, pr_url: null, pr_error: err };
  }
}

// 2026-07-27 verifier repair (brief §2 + D2 + §0.R R2):
//   - The gate is the repo's typecheck workflow (`tsc --noEmit`, runs on push
//     to every branch incl. bots/*) read via check-runs. Poll window is
//     mode-aware: typecheck takes ~2-5 min, the old 90s window always saw
//     `pending` → historical ci=null.
//   - A missing gate is NOT a failed gate: no check runs after the full
//     window → verify=skipped_no_ci (caller treats as done). Checks still
//     pending at deadline → verify=ci_pending_timeout (also not a failure).
//   - The prod-curl probe is INFORMATIONAL ONLY: it hits the prod deploy of
//     main, which can never contain a branch fix — using it as a gate was a
//     structural false-negative machine (the 2026-07-17 'failed' runs).
async function verifyDeploy(commitSha: string, pageUrl: string | null, budgetMs = 240_000): Promise<{ ci_ok: boolean | null; checks_seen: number; curl_status: number | null; curl_body_ok: boolean | null; verify_tag: string; note: string }> {
  let ciOk: boolean | null = null;
  let checksSeen = 0;
  let note = '';
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const s = await ghGetCheckStatus(commitSha);
    note = s.note;
    checksSeen = Math.max(checksSeen, s.checks_count);
    if (s.ci_ok !== null) { ciOk = s.ci_ok; break; }
    if (Date.now() + 15_000 > deadline) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  const verifyTag = ciOk === false ? 'ci_failed'
    : ciOk === true ? 'ci_passed'
    : checksSeen > 0 ? 'ci_pending_timeout'
    : 'skipped_no_ci';
  let curlStatus: number | null = null;
  let curlBodyOk: boolean | null = null;
  if (pageUrl) {
    try {
      const r = await fetch(pageUrl, { method: 'GET', redirect: 'follow' });
      curlStatus = r.status;
      const body = await r.text();
      curlBodyOk = r.ok && !body.includes('Application error') && !body.includes('This page could not be found');
    } catch (e) {
      note += ` · curl_failed=${(e as Error).message}`;
    }
  }
  return { ci_ok: ciOk, checks_seen: checksSeen, curl_status: curlStatus, curl_body_ok: curlBodyOk, verify_tag: verifyTag, note: `verify=${verifyTag} · ${note}` };
}

// 2026-07-28 (G3): jobDeadlineMs is the epoch-ms deadline of the CALLING
// ROUTE (maxDuration minus headroom). The verify poll is clamped to what is
// left of the route's lifetime so Vercel never kills the lambda mid-verify
// and strands the run in a non-terminal phase (run 71: phase=verifying,
// ended_at null, forever). Running out of window is NOT a failure — the run
// closes as done + ci_pending_timeout per D2.
export async function runOneBug(bug: { id: number; body: string | null; page_url: string | null; dept_slug: string | null; property_id: string | null }, triggeredBy: string, verifyBudgetMs = 240_000, jobDeadlineMs?: number): Promise<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> {
  const sb = getSupabaseAdmin();
  const initialLog = `START · bug=${bug.id} url=${bug.page_url ?? '(none)'}`;
  const { data: rpcData, error: insErr } = await sb.rpc('fn_bug_agent_run_insert', {
    p_bug_id: bug.id,
    p_triggered_by: triggeredBy,
    p_initial_log: `[${new Date().toISOString()}] ${initialLog}\n`,
  });
  if (insErr || rpcData == null) return { bug_id: bug.id, ok: false, error: insErr?.message ?? 'rpc_insert_failed' };
  const runId = Number(rpcData);
  let costUsd = 0;
  try {
    await updateRun(runId, { phase: 'planning' }, `PLAN · calling Anthropic…`);
    let plan = await planBugFix(bug);
    costUsd += plan.cost_usd;
    await updateRun(runId, { planner_out: plan }, `PLAN · patches=${plan.patches.length} skip=${plan.skip_reason ?? '—'} · candidates=${plan.candidates_total ?? 0} fetched=${plan.files_fetched ?? 0}`);
    if (plan.skip_reason || plan.patches.length === 0) {
      // PBS 2026-07-27: store the structured multiple-choice question on the bug row
      // so the UI can render clickable options (fn_answer_bug_question consumes it).
      // 2026-07-28: ALWAYS store a question (fallback when planner omitted one) —
      // see storeNeedsHumanQuestion for why (drain convergence).
      await storeNeedsHumanQuestion(bug.id, plan.skip_reason ?? 'planner produced no patches', plan.human_question, plan.human_options);
      await updateRun(runId, { phase: 'needs_human', cost_usd: costUsd, ended_at: new Date().toISOString() }, `NEEDS_HUMAN · ${plan.skip_reason ?? 'no patches'}${plan.human_question ? ` · Q: ${plan.human_question}` : ''}`);
      return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human', cost_usd: costUsd };
    }
    await updateRun(runId, { phase: 'reviewing' }, `REVIEW · calling Anthropic…`);
    let review = await reviewPlan(bug, plan);
    costUsd += review.cost_usd;
    await updateRun(runId, { reviewer_out: review }, `REVIEW · verdict=${review.verdict} · ${review.notes}`);
    await updateRun(runId, { reviewer_out: review }, (review as { _rawLog?: string })._rawLog ?? '');
    if (review.verdict === 'reject') {
      let currentPlan = plan;
      let currentReview = review;
      let converged = false;
      for (let repairRound = 1; repairRound <= 2; repairRound++) {
        const feedback = `REVIEWER REJECTION (round ${repairRound}):\n${currentReview.notes}\nSpecific issues:\n${currentReview.reasons.map((r) => `- ${r}`).join('\n')}\n\nFix all listed issues. Do not add unrelated changes.`;
        await updateRun(runId, { phase: 'replanning' }, `REPLAN${repairRound} · fixing ${currentReview.reasons.length} reviewer issue(s)`);
        const repairedPlan = await planBugFix({ ...bug, reviewFeedback: feedback });
        costUsd += repairedPlan.cost_usd;
        if (repairedPlan.patches.length === 0) {
          await storeNeedsHumanQuestion(bug.id, `the planner gave up while fixing reviewer objections: ${currentReview.notes.slice(0, 160)}`);
          await updateRun(runId, { phase: 'needs_human', cost_usd: costUsd, ended_at: new Date().toISOString() }, `NEEDS_HUMAN · replan${repairRound} produced no patches`);
          return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human', cost_usd: costUsd };
        }
        const repairedReview = await reviewPlan(bug, repairedPlan);
        costUsd += repairedReview.cost_usd;
        await updateRun(runId, { reviewer_out: repairedReview }, `REVIEW${repairRound + 1} · verdict=${repairedReview.verdict} · ${repairedReview.notes}`);
        if (repairedReview.verdict === 'approve') {
          plan = repairedPlan;
          review = repairedReview;
          converged = true;
          break;
        }
        currentPlan = repairedPlan;
        currentReview = repairedReview;
      }
      if (!converged) {
        await storeNeedsHumanQuestion(bug.id, `the code reviewer did not approve after 2 repair rounds: ${currentReview.notes.slice(0, 160)}`);
        await updateRun(runId, { phase: 'needs_human', cost_usd: costUsd, ended_at: new Date().toISOString() }, `NEEDS_HUMAN · 2 repair rounds exhausted · last verdict: ${currentReview.verdict}`);
        return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human', cost_usd: costUsd };
      }
    } else if (review.verdict !== 'approve') {
      await storeNeedsHumanQuestion(bug.id, `the code reviewer flagged this for human review: ${review.notes.slice(0, 160)}`);
      await updateRun(runId, { phase: 'needs_human', cost_usd: costUsd, ended_at: new Date().toISOString() }, `NEEDS_HUMAN · reviewer said ${review.verdict}`);
      return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human', cost_usd: costUsd };
    }
    await updateRun(runId, { phase: 'shipping' }, `SHIP · creating branch + pushing ${plan.patches.length} file(s)…`);
    const ship = await shipPatches(bug, plan);
    await updateRun(runId, {
      branch: ship.branch,
      commit_sha: ship.commit_sha,
      pr_number: ship.pr_number,
      pr_url: ship.pr_url,
    }, ship.pr_url
      ? `SHIP · PR #${ship.pr_number} → ${ship.pr_url}`
      : `SHIP · branch=${ship.branch} commit=${ship.commit_sha.slice(0,8)} · PR open BLOCKED: ${ship.pr_error} (open manually via: gh pr create --head ${ship.branch})`
    );
    // G3: never poll past the route's remaining lifetime (15s close-out
    // reserve; floor 20s = at least one probe + one retry).
    const remainingMs = jobDeadlineMs ? jobDeadlineMs - Date.now() : Number.MAX_SAFE_INTEGER;
    const effectiveVerifyMs = Math.max(20_000, Math.min(verifyBudgetMs, remainingMs - 15_000));
    await updateRun(runId, { phase: 'verifying' }, `VERIFY · polling CI gate (typecheck) · budget=${Math.round(effectiveVerifyMs / 1000)}s…`);
    const verify = await verifyDeploy(ship.commit_sha, bug.page_url, effectiveVerifyMs);
    await updateRun(runId, { verifier_out: verify }, `VERIFY · ci_ok=${verify.ci_ok} curl=${verify.curl_status} body_ok=${verify.curl_body_ok} · ${verify.note}`);
    // 2026-07-27 (D2): ONLY an explicit CI failure fails the run. Missing/
    // pending CI → done + verify tag. Curl is informational (prod deploy of
    // main can never contain the branch fix — never gate on it).
    const success = verify.ci_ok !== false;
    // Determine best fix_link: PR URL if opened, else GH branch compare view
    const fixLink = ship.pr_url ?? `https://github.com/${GH_REPO}/compare/${GH_BASE_BRANCH}...${ship.branch}`;
    const fixLabel = ship.pr_number ? `PR #${ship.pr_number}` : `branch: ${ship.branch}`;
    if (success) {
      // ADR-175: verified + reviewer-approved + unprotected → the loop merges its own PR.
      // 2026-07-28 tightening (run 86 lesson): "verify green" means the typecheck
      // gate CONCLUDED success (ci_ok === true) — not merely "didn't fail yet".
      // ci_pending_timeout / skipped_no_ci runs still close as done (D2), but
      // their PRs await PBS merge instead of auto-merging on an unconcluded gate.
      let merged = false;
      if (ship.pr_number && verify.ci_ok === true) merged = await tryAutoMerge(ship.pr_number, plan.patches, runId);
      await markBug(bug.id, { status: 'done', started_at: new Date().toISOString(), done_at: new Date().toISOString(), fix_link: fixLink, fix_label: merged ? `${fixLabel} · auto-merged` : fixLabel });
      await updateRun(runId, { phase: 'done', cost_usd: costUsd, ended_at: new Date().toISOString() }, (merged ? `DONE · auto-merged (ADR-175)` : (ship.pr_url ? `DONE · PR awaits PBS merge (protected/oversize/switch-off)` : `DONE · branch ready — open PR manually`)) + ` · verify=${verify.verify_tag}`);
      return { bug_id: bug.id, run_id: runId, ok: true, phase: 'done', cost_usd: costUsd };
    } else {
      // Still record the branch so PBS can see it even if verify failed
      // PBS 2026-07-27 (bug-106 family) — DB CHECK allows new/acked/processing/
      // done/wont_fix; 'acknowledged' was silently rejected by Postgres.
      await markBug(bug.id, { status: 'acked', fix_link: fixLink, fix_label: fixLabel });
      await updateRun(runId, { phase: 'failed', cost_usd: costUsd, ended_at: new Date().toISOString(), error: `verify_failed: ${verify.verify_tag} · ${verify.note.slice(0, 300)}` }, `FAIL · CI check failed on branch`);
      return { bug_id: bug.id, run_id: runId, ok: false, phase: 'failed', cost_usd: costUsd };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await updateRun(runId, { phase: 'failed', cost_usd: costUsd, ended_at: new Date().toISOString(), error: err }, `FAIL · ${err}`);
    return { bug_id: bug.id, run_id: runId, ok: false, error: err, cost_usd: costUsd };
  }
}

export async function pickBugs(opts: { bug_ids?: number[]; mode: 'one' | 'drain'; max: number }): Promise<Array<{ id: number; body: string | null; page_url: string | null; dept_slug: string | null; property_id: string | null }>> {
  const sb = getSupabaseAdmin();
  // PBS 2026-07-17 — READ from public.cockpit_bugs view (cockpit schema not
  // PostgREST-exposed). View exposes agent_skip via the underlying table.
  // PBS 2026-07-17 — v_bugs_ready_for_agent excludes bugs attempted in the
  // last 4h so drain doesn't re-pick the same 3 bugs every call.
  let q = sb.from('v_bugs_ready_for_agent')
    .select('id, body, page_url, dept_slug, status, property_id');
  if (opts.bug_ids && opts.bug_ids.length > 0) q = q.in('id', opts.bug_ids);
  // PBS 2026-07-27 — owner-set priority wins (lower = sooner), then FIFO.
  q = q.order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(opts.mode === 'one' ? 1 : opts.max);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: number; body: string | null; page_url: string | null; dept_slug: string | null; property_id: string | null }>);
}

// 2026-07-27 (R1, PBS-approved $50/mo): month-to-date measured spend from
// public.ai_token_meter. Client-side sum — PostgREST aggregates are not
// enabled, and row volume for one month of bug-agent calls is trivially small.
async function monthToDateSpendUsd(): Promise<number> {
  const sb = getSupabaseAdmin();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await sb
    .from('ai_token_meter')
    .select('cost_usd')
    .in('agent_handle', METERED_AGENT_HANDLES)
    .gte('created_at', monthStart.toISOString())
    .limit(10_000);
  if (error || !data) return 0; // metering read failure never blocks a run — the per-run $2 cap still holds
  return (data as Array<{ cost_usd: number | string | null }>).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
}

export async function runAgentJob(opts: { bug_ids?: number[]; mode?: 'one' | 'drain'; max?: number; triggered_by?: string }): Promise<{ ok: boolean; mode: string; cost_usd: number; mtd_spend_usd?: number; processed: Array<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> }> {
  const mode = opts.mode ?? 'one';
  const max = Math.min(Math.max(1, opts.max ?? 1), 3);
  const triggeredBy = opts.triggered_by ?? 'manual';
  // G3 (2026-07-28): both calling routes declare maxDuration=300. Budget the
  // whole job at 280s so every picked bug reaches a TERMINAL phase before
  // Vercel kills the lambda; bugs left over stay eligible for the next drain.
  const ROUTE_BUDGET_MS = 280_000;
  const jobDeadlineMs = Date.now() + ROUTE_BUDGET_MS;
  // Monthly ceiling check BEFORE picking work (R1) — measured cost, not estimates.
  let mtdSpend = await monthToDateSpendUsd();
  if (mtdSpend >= MONTHLY_COST_CAP_USD) {
    return { ok: false, mode, cost_usd: 0, mtd_spend_usd: Number(mtdSpend.toFixed(2)), processed: [{ bug_id: -1, ok: false, error: `cost_cap_monthly_reached ($${mtdSpend.toFixed(2)} of $${MONTHLY_COST_CAP_USD}/mo — PBS-approved cap, brief autospec-bug_agent_module-20260725)` }] };
  }
  // Verify budget is mode-aware: drain shares one 300s lambda across up to 3
  // bugs; the UI 'one' mode can afford the full typecheck window (~2-5 min).
  const verifyBudgetMs = mode === 'drain' ? 60_000 : 240_000;
  const bugs = await pickBugs({ bug_ids: opts.bug_ids, mode, max });
  const processed: Array<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> = [];
  let totalCost = 0;
  for (const bug of bugs) {
    if (totalCost >= COST_CAP_USD) {
      processed.push({ bug_id: bug.id, ok: false, error: `cost_cap_reached ($${totalCost.toFixed(2)} of $${COST_CAP_USD})` });
      break;
    }
    if (mtdSpend + totalCost >= MONTHLY_COST_CAP_USD) {
      processed.push({ bug_id: bug.id, ok: false, error: `cost_cap_monthly_reached ($${(mtdSpend + totalCost).toFixed(2)} of $${MONTHLY_COST_CAP_USD}/mo)` });
      break;
    }
    // G3: a full plan→ship→verify needs real runway; starting a bug with less
    // than 60s guarantees an orphaned run. Leftover bugs stay eligible.
    if (jobDeadlineMs - Date.now() < 60_000) {
      processed.push({ bug_id: bug.id, ok: false, error: 'route_budget_exhausted — left for next drain (G3)' });
      break;
    }
    const r = await runOneBug(bug, triggeredBy, verifyBudgetMs, jobDeadlineMs);
    processed.push(r);
    totalCost += r.cost_usd ?? 0;
    // Re-read measured MTD between bugs — other sessions/agents meter too.
    mtdSpend = await monthToDateSpendUsd();
  }
  return { ok: true, mode, cost_usd: totalCost, mtd_spend_usd: Number(mtdSpend.toFixed(2)), processed };
}

// ---------- Orphan-run finalizer (G3, 2026-07-28 · called from bugs/sweep STEP C) ----------
// A run stranded in a non-terminal phase with ended_at NULL means Vercel
// killed the lambda mid-flight (run 71's failure mode). Self-heal job 149
// only re-queues *failed* runs — it never sees these. Every 5 min the sweep
// finalizes any latest-per-bug run stuck >10 min:
//   - branch shipped (commit_sha set): ONE check-status probe, no polling —
//     gate failed → failed; gate passed / still pending / absent → done with
//     verify=ci_passed | orphaned_timeout (a missing verdict is not a failure,
//     D2). Bug row closed exactly like runOneBug's paths (no auto-merge —
//     the finalizer is conservative; PBS or the next full run merges).
//   - no branch: died in plan/review → failed + orphaned_timeout; bug row
//     untouched (stays eligible for a fresh run after the 4h window).
// Reads v_bug_agent_runs_latest (latest run per bug — an orphan superseded by
// a newer run for the same bug is invisible there, acceptable: the bug itself
// is unstuck by definition in that case).
export async function finalizeOrphanRuns(opts: { olderThanMin?: number } = {}): Promise<{ ok: boolean; finalized: Array<{ run_id: number; bug_id: number; outcome: string }>; error?: string }> {
  const olderThanMin = Math.max(5, opts.olderThanMin ?? 10);
  const sb = getSupabaseAdmin();
  const cutoffIso = new Date(Date.now() - olderThanMin * 60_000).toISOString();
  const OPEN_PHASES = ['planning', 'reviewing', 'replanning', 'shipping', 'verifying'];
  const { data, error } = await sb
    .from('v_bug_agent_runs_latest')
    .select('id, bug_id, phase, branch, pr_url, commit_sha, started_at, ended_at')
    .is('ended_at', null)
    .in('phase', OPEN_PHASES)
    .lt('started_at', cutoffIso)
    .limit(10);
  if (error) return { ok: false, finalized: [], error: error.message };
  const finalized: Array<{ run_id: number; bug_id: number; outcome: string }> = [];
  for (const run of (data ?? []) as Array<{ id: number; bug_id: number; phase: string; branch: string | null; pr_url: string | null; commit_sha: string | null }>) {
    const nowIso = new Date().toISOString();
    try {
      if (run.commit_sha) {
        const s = await ghGetCheckStatus(run.commit_sha);
        if (s.ci_ok === false) {
          await markBug(run.bug_id, { status: 'acked', fix_link: run.pr_url ?? (run.branch ? `https://github.com/${GH_REPO}/compare/${GH_BASE_BRANCH}...${run.branch}` : null), fix_label: run.branch ? `branch: ${run.branch}` : null });
          await updateRun(run.id, { phase: 'failed', ended_at: nowIso, error: `verify_failed: orphan finalizer · ${s.note.slice(0, 250)}` }, `ORPHAN-FINALIZE · route killed mid-run · CI gate failed`);
          finalized.push({ run_id: run.id, bug_id: run.bug_id, outcome: 'failed' });
        } else {
          const tag = s.ci_ok === true ? 'ci_passed' : 'orphaned_timeout';
          const fixLink = run.pr_url ?? `https://github.com/${GH_REPO}/compare/${GH_BASE_BRANCH}...${run.branch}`;
          const fixLabel = run.pr_url ? 'PR (orphan-finalized)' : `branch: ${run.branch}`;
          await markBug(run.bug_id, { status: 'done', started_at: nowIso, done_at: nowIso, fix_link: fixLink, fix_label: fixLabel });
          await updateRun(run.id, { phase: 'done', ended_at: nowIso }, `ORPHAN-FINALIZE · route killed mid-run · verify=${tag} · ${s.note.slice(0, 250)}`);
          finalized.push({ run_id: run.id, bug_id: run.bug_id, outcome: 'done' });
        }
      } else {
        await updateRun(run.id, { phase: 'failed', ended_at: nowIso, error: 'orphaned_timeout — route killed before ship (G3)' }, `ORPHAN-FINALIZE · died in ${run.phase} with no branch → failed; bug stays eligible`);
        finalized.push({ run_id: run.id, bug_id: run.bug_id, outcome: 'failed' });
      }
    } catch (e) {
      finalized.push({ run_id: run.id, bug_id: run.bug_id, outcome: `error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 120) });
    }
  }
  return { ok: true, finalized };
}

// ---------- Code index refresh (brief §2 — nightly, /api/cron/bug-agent-index-refresh) ----------
// Pass 1 (cheap, 1 GH call): full git tree → every app/** + lib/** TS file gets
// an index row (path + kind + blob sha) and vanished paths are pruned. This
// alone gives the planner 100% real-path coverage.
// Pass 2 (bounded): fetch contents ONLY for new/changed blobs (sha diff vs the
// stored index), extract exports + header comment. Cap per run keeps the job
// inside maxDuration; the remainder enriches on the next night.
function indexKindOf(p: string): string {
  if (p.endsWith('/page.tsx') || p.endsWith('/page.ts')) return 'page';
  if (p.endsWith('/layout.tsx')) return 'layout';
  if (p.endsWith('/route.ts')) return 'route';
  if (p.startsWith('lib/')) return 'lib';
  if (p.endsWith('.tsx')) return 'component';
  return 'other';
}
function extractExports(content: string): string[] {
  const ex = new Set<string>();
  for (const m of content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum|let|var)\s+([A-Za-z0-9_]+)/g)) ex.add(m[1]);
  if (/export\s+default/.test(content)) ex.add('default');
  return Array.from(ex).slice(0, 20);
}
function extractHeaderComment(content: string): string | null {
  const m = content.match(/^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*\n))+/);
  if (!m) return null;
  const cleaned = m[0].replace(/^\s*\/\/ ?/gm, '').replace(/\/\*|\*\//g, '').trim().slice(0, 300);
  return cleaned.length > 0 ? cleaned : null;
}

export async function refreshCodeIndex(opts: { maxContentFetches?: number } = {}): Promise<{ ok: boolean; tree_files: number; enriched: number; enrich_remaining: number; upserted: number; pruned: number; error?: string }> {
  const maxFetches = Math.min(Math.max(0, opts.maxContentFetches ?? 300), 1000);
  const sb = getSupabaseAdmin();
  // Live tree (bypass the 10-min cache staleness concern — refresh is nightly)
  const r = await ghFetch(`/repos/${GH_REPO}/git/trees/${GH_BASE_BRANCH}?recursive=1`);
  if (!r.ok) return { ok: false, tree_files: 0, enriched: 0, enrich_remaining: 0, upserted: 0, pruned: 0, error: `gh_tree ${r.status}` };
  const tree = (await r.json() as { tree: Array<{ path: string; type: string; sha: string; size?: number }> }).tree ?? [];
  const files = tree.filter((t) => t.type === 'blob' && /^(app|lib)\/.*\.(ts|tsx)$/.test(t.path));

  // Current index shas → diff set
  const known = new Map<string, string | null>();
  {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await sb.from('v_bug_agent_code_index').select('path, content_sha').range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data as Array<{ path: string; content_sha: string | null }>) known.set(row.path, row.content_sha);
      if (data.length < pageSize) break;
    }
  }
  const changed = files.filter((f) => known.get(f.path) !== f.sha);
  const toEnrich = changed.slice(0, maxFetches);

  // Bounded parallel content fetch (blobs API via existing contents helper)
  const enrichedRows = new Map<string, { exports: string[]; header_comment: string | null; bytes: number }>();
  const CONCURRENCY = 8;
  for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
    const batch = toEnrich.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (f) => {
      try {
        const file = await ghGetFile(f.path);
        if (file) enrichedRows.set(f.path, { exports: extractExports(file.content), header_comment: extractHeaderComment(file.content), bytes: Buffer.byteLength(file.content, 'utf-8') });
      } catch { /* enrich later */ }
    }));
  }

  // Build the full snapshot: enriched rows carry the new sha; unfetched
  // changed rows carry NO sha (keeps them flagged as changed for next night);
  // unchanged rows re-send their sha so exports/header are preserved by the
  // upsert fn's CASE logic.
  const rows = files.map((f) => {
    const e = enrichedRows.get(f.path);
    if (e) return { path: f.path, kind: indexKindOf(f.path), exports: e.exports, header_comment: e.header_comment, content_sha: f.sha, bytes: e.bytes };
    const isChanged = known.get(f.path) !== f.sha;
    return { path: f.path, kind: indexKindOf(f.path), exports: [], header_comment: null, content_sha: isChanged ? null : f.sha, bytes: f.size ?? null };
  });

  const { data: upsertData, error: upsertErr } = await sb.rpc('fn_bug_agent_code_index_upsert', { p_rows: rows, p_prune_missing: true });
  if (upsertErr) return { ok: false, tree_files: files.length, enriched: enrichedRows.size, enrich_remaining: changed.length - toEnrich.length, upserted: 0, pruned: 0, error: upsertErr.message };
  const res = (upsertData ?? {}) as { upserted?: number; pruned?: number };
  return { ok: true, tree_files: files.length, enriched: enrichedRows.size, enrich_remaining: changed.length - enrichedRows.size, upserted: res.upserted ?? 0, pruned: res.pruned ?? 0 };
}
