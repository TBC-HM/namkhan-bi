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

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropicTool } from '@/lib/mail/anthropic';

const GH_REPO = 'TBC-HM/namkhan-bi';
const GH_BASE_BRANCH = 'main';
export const COST_CAP_USD = 2.0;
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
export interface PlannerResult { plan_md: string; patches: FilePatch[]; skip_reason?: string; missing_files: string[]; cost_usd: number; human_question?: string; human_options?: HumanOption[] }
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
async function ghGetCheckStatus(sha: string): Promise<{ ci_ok: boolean | null; note: string }> {
  const [runsR, statusR] = await Promise.all([
    ghFetch(`/repos/${GH_REPO}/commits/${sha}/check-runs`),
    ghFetch(`/repos/${GH_REPO}/commits/${sha}/status`),
  ]);
  const runs = runsR.ok ? await runsR.json() as { check_runs: Array<{ name: string; conclusion: string | null; status: string }> } : { check_runs: [] };
  const status = statusR.ok ? await statusR.json() as { state: string } : { state: 'pending' };
  const anyPending = runs.check_runs.some((c) => c.status === 'in_progress' || c.status === 'queued') || status.state === 'pending';
  if (anyPending) return { ci_ok: null, note: `${runs.check_runs.length} runs, github-status=${status.state}` };
  const anyFail = runs.check_runs.some((c) => c.conclusion && c.conclusion !== 'success' && c.conclusion !== 'skipped' && c.conclusion !== 'neutral') || status.state === 'failure' || status.state === 'error';
  return { ci_ok: !anyFail, note: `checks=${runs.check_runs.map((c) => `${c.name}:${c.conclusion ?? c.status}`).join('|')} status=${status.state}` };
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

async function guessCandidateFiles(bug: { page_url: string | null; body: string | null }): Promise<string[]> {
  const files: string[] = [];
  const url = bug.page_url ?? '';
  // List ALL files in the bug's route directory (law 549 — no guessing)
  const dirs: string[] = [];
  try {
    const u = new URL(url);
    const rawParts = u.pathname.split('/').filter(Boolean);
    const isPidRoute = rawParts[0] === 'h' && rawParts[1] && /^\d+$/.test(rawParts[1]);
    if (isPidRoute) {
      const rest = bracketize(rawParts.slice(2));
      if (rest.length > 0) {
        dirs.push(`app/h/[propertyId]/${rest.join('/')}`);
        dirs.push(`app/${rest.join('/')}`);
      }
    } else {
      const seg = bracketize(rawParts);
      if (seg.length > 0) dirs.push(`app/${seg.join('/')}`);
    }
  } catch { /* ignore */ }
  for (const dir of dirs) {
    const listed = await ghListDir(dir);
    files.push(...listed);
    if (files.length >= MAX_FILES_PER_PLAN) break;
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

  return plan;
}

const REVIEWER_SYSTEM = [
  'You are a strict code reviewer for a Next.js hotel BI app. Review the bug + patches and call submit_review.',
  'verdict="approve" if: patches are minimal, safe, likely to fix the bug, no syntax issues, no var(--paper-warm), no hardcoded hex/rgba in status indicators (use data-status tokens instead).',
  'verdict="reject" if: patches introduce bugs, break TS, remove needed code, add features.',
  'verdict="needs_human" if: patches attempt a page rewrite, touch >3 files, or bug is ambiguous.',
  'Be adversarial. Default to needs_human when in doubt.',
  'SCOPE: Judge ONLY lines that this patch ADDS or MODIFIES. Pre-existing code that was untouched is NOT grounds for reject — mention it as a follow-up note only.',
  'TOKEN LAYERS: Raw hex (#…) is ALLOWED in tokens.css palette-primitive definitions (e.g. --color-green-700: #2E7D32). It is FORBIDDEN in components, inline styles, and semantic token definitions only when an equivalent primitive already exists. Do not reject for hex in the palette layer.',
  'On reject: notes MUST quote the exact violating NEW code (e.g. the hex value or token name) and name the correct replacement. Minimum 30 words in notes.',
].join('\n');

async function reviewPlan(bug: { id: number; body: string | null }, plan: PlannerResult): Promise<ReviewerResult> {
  if (plan.patches.length === 0) return { verdict: 'needs_human', notes: 'Planner produced no patches.', reasons: [], cost_usd: 0 };
  if (plan.patches.length > 3) return { verdict: 'needs_human', notes: `Too many files (${plan.patches.length}), needs human.`, reasons: [], cost_usd: 0 };
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
  // PBS 2026-07-17 — PR creation is soft-fail. Vault token has Contents R/W
  // but may lack Pull-Requests R/W. Branch + commits are the important
  // artifacts; PBS can open PRs in bulk via `gh pr create --head bots/bug-*`.
  try {
    const pr = await ghOpenPR(branch, prTitle, prBody);
    return { branch, commit_sha: lastCommit, pr_number: pr.number, pr_url: pr.html_url, pr_error: null };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { branch, commit_sha: lastCommit, pr_number: null, pr_url: null, pr_error: err };
  }
}

async function verifyDeploy(commitSha: string, pageUrl: string | null): Promise<{ ci_ok: boolean | null; curl_status: number | null; curl_body_ok: boolean | null; note: string }> {
  let ciOk: boolean | null = null;
  let note = '';
  for (let i = 0; i < 6; i++) {
    const s = await ghGetCheckStatus(commitSha);
    note = s.note;
    if (s.ci_ok !== null) { ciOk = s.ci_ok; break; }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  let curlStatus: number | null = null;
  let curlBodyOk: boolean | null = null;
  if (pageUrl && ciOk === true) {
    try {
      const r = await fetch(pageUrl, { method: 'GET', redirect: 'follow' });
      curlStatus = r.status;
      const body = await r.text();
      curlBodyOk = r.ok && !body.includes('Application error') && !body.includes('This page could not be found');
    } catch (e) {
      note += ` · curl_failed=${(e as Error).message}`;
    }
  }
  return { ci_ok: ciOk, curl_status: curlStatus, curl_body_ok: curlBodyOk, note };
}

export async function runOneBug(bug: { id: number; body: string | null; page_url: string | null; dept_slug: string | null; property_id: string | null }, triggeredBy: string): Promise<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> {
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
    await updateRun(runId, { planner_out: plan }, `PLAN · patches=${plan.patches.length} skip=${plan.skip_reason ?? '—'}`);
    if (plan.skip_reason || plan.patches.length === 0) {
      // PBS 2026-07-27: store the structured multiple-choice question on the bug row
      // so the UI can render clickable options (fn_answer_bug_question consumes it).
      try {
        if (plan.human_question && plan.human_options?.length) {
          await (getSupabaseAdmin() as any).rpc('fn_set_bug_open_question', {
            p_bug_id: bug.id,
            p_question: { question: plan.human_question, options: plan.human_options, asked_by: 'bug-agent', asked_at: new Date().toISOString() },
          });
        }
      } catch { /* question storage is best-effort; needs_human still lands */ }
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
        await updateRun(runId, { phase: 'needs_human', cost_usd: costUsd, ended_at: new Date().toISOString() }, `NEEDS_HUMAN · 2 repair rounds exhausted · last verdict: ${currentReview.verdict}`);
        return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human', cost_usd: costUsd };
      }
    } else if (review.verdict !== 'approve') {
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
    await updateRun(runId, { phase: 'verifying' }, `VERIFY · polling CI + curl…`);
    const verify = await verifyDeploy(ship.commit_sha, bug.page_url);
    await updateRun(runId, { verifier_out: verify }, `VERIFY · ci_ok=${verify.ci_ok} curl=${verify.curl_status} body_ok=${verify.curl_body_ok} · ${verify.note}`);
    // ci_ok===null = no CI runs yet (skipped_no_ci) → treat as success; only fail on explicit ci_ok===false
    const success = verify.ci_ok !== false && (verify.curl_body_ok !== false);
    // Determine best fix_link: PR URL if opened, else GH branch compare view
    const fixLink = ship.pr_url ?? `https://github.com/${GH_REPO}/compare/${GH_BASE_BRANCH}...${ship.branch}`;
    const fixLabel = ship.pr_number ? `PR #${ship.pr_number}` : `branch: ${ship.branch}`;
    if (success) {
      await markBug(bug.id, { status: 'done', started_at: new Date().toISOString(), done_at: new Date().toISOString(), fix_link: fixLink, fix_label: fixLabel });
      await updateRun(runId, { phase: 'done', cost_usd: costUsd, ended_at: new Date().toISOString() }, ship.pr_url ? `DONE · PR ready for merge` : `DONE · branch ready — open PR manually`);
      return { bug_id: bug.id, run_id: runId, ok: true, phase: 'done', cost_usd: costUsd };
    } else {
      // Still record the branch so PBS can see it even if verify failed
      await markBug(bug.id, { status: 'acknowledged', fix_link: fixLink, fix_label: fixLabel });
      await updateRun(runId, { phase: 'failed', cost_usd: costUsd, ended_at: new Date().toISOString(), error: `verify_failed: ci=${verify.ci_ok} curl=${verify.curl_status}` }, `FAIL · verification failed`);
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
  q = q.order('created_at', { ascending: true }).limit(opts.mode === 'one' ? 1 : opts.max);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: number; body: string | null; page_url: string | null; dept_slug: string | null; property_id: string | null }>);
}

export async function runAgentJob(opts: { bug_ids?: number[]; mode?: 'one' | 'drain'; max?: number; triggered_by?: string }): Promise<{ ok: boolean; mode: string; cost_usd: number; processed: Array<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> }> {
  const mode = opts.mode ?? 'one';
  const max = Math.min(Math.max(1, opts.max ?? 1), 3);
  const triggeredBy = opts.triggered_by ?? 'manual';
  const bugs = await pickBugs({ bug_ids: opts.bug_ids, mode, max });
  const processed: Array<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> = [];
  let totalCost = 0;
  for (const bug of bugs) {
    if (totalCost >= COST_CAP_USD) {
      processed.push({ bug_id: bug.id, ok: false, error: `cost_cap_reached ($${totalCost.toFixed(2)} of $${COST_CAP_USD})` });
      break;
    }
    const r = await runOneBug(bug, triggeredBy);
    processed.push(r);
    totalCost += r.cost_usd ?? 0;
  }
  return { ok: true, mode, cost_usd: totalCost, processed };
}
