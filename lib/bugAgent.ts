// lib/bugAgent.ts
// PBS 2026-07-17 — Shared orchestrator for the bug-agent pipeline.
// Called by:
//   - /api/cockpit/bugs/agent-run   (UI button, cookie-auth)
//   - /api/cron/bug-agent-drain     (pg_cron, middleware-bypassed)
//
// Full pipeline per bug: PLAN → REVIEW → SHIP → VERIFY → CLOSE.
// See /api/cockpit/bugs/agent-run/route.ts for the surface docs.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic } from '@/lib/mail/anthropic';

const GH_REPO = 'TBC-HM/namkhan-bi';
const GH_BASE_BRANCH = 'main';
export const COST_CAP_USD = 2.0;
const MAX_FILES_PER_PLAN = 2;   // PBS 2026-07-17 — reduced from 3 to keep run < 60s
const MAX_FILE_BYTES = 20_000;  // reduced from 40k

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
export interface PlannerResult { plan_md: string; patches: FilePatch[]; skip_reason?: string; cost_usd: number }
export interface ReviewerResult { verdict: 'approve' | 'reject' | 'needs_human'; notes: string; cost_usd: number }

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

function guessCandidateFiles(bug: { page_url: string | null; body: string | null }): string[] {
  const files: string[] = [];
  const url = bug.page_url ?? '';
  try {
    const u = new URL(url);
    const rawParts = u.pathname.split('/').filter(Boolean);
    const isPidRoute = rawParts[0] === 'h' && rawParts[1] && /^\d+$/.test(rawParts[1]);
    if (isPidRoute) {
      const rest = bracketize(rawParts.slice(2));
      if (rest.length > 0) {
        files.push(`app/h/[propertyId]/${rest.join('/')}/page.tsx`);
        files.push(`app/${rest.join('/')}/page.tsx`);
        const cap = rest[rest.length - 1].replace(/[[\]]/g,'').split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
        if (cap) files.push(`app/h/[propertyId]/${rest.join('/')}/_components/${cap}Client.tsx`);
      }
    } else {
      const seg = bracketize(rawParts);
      if (seg.length > 0) {
        files.push(`app/${seg.join('/')}/page.tsx`);
        const cap = seg[seg.length - 1].replace(/[[\]]/g,'').split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
        if (cap) files.push(`app/${seg.join('/')}/_components/${cap}Client.tsx`);
      }
    }
  } catch { /* ignore */ }
  const body = (bug.body ?? '').toLowerCase();
  if (body.includes('menu') || body.includes('nav') || body.includes('belong') || body.includes('subpage') || body.includes('sub-page') || body.includes('holding') || body.includes('namkhan')) {
    files.push('lib/dept-cfg/index.ts');
  }
  return Array.from(new Set(files)).slice(0, MAX_FILES_PER_PLAN);
}

const PLANNER_SYSTEM = [
  'You are a senior TypeScript engineer fixing a bug in a Next.js 15 App Router codebase for The Namkhan hotel BI.',
  'Design rules: paper-white #FFFFFF, hairlines #E6DFCC, ink #1B1B1B, ink-soft #5A5A5A, brand green #084838. NEVER use `var(--paper-warm)` (renders dark).',
  'You will be given the bug report + candidate source files. Output ONLY a JSON object matching this schema:',
  '{ "plan_md": "1-3 sentence plan", "patches": [{"path": "app/x/y.tsx", "new_content": "FULL FILE CONTENT after your edit", "reasoning": "why"}], "skip_reason": null | "cannot fix without X" }',
  'CRITICAL RULES:',
  '- `new_content` must be the COMPLETE file content, not a diff. Preserve all imports, exports, unchanged code exactly.',
  '- Do NOT add features or refactor beyond what the bug asks. Minimal surgical change only.',
  '- If the bug is unclear, too big (page rewrite), or requires DB changes, set skip_reason and return patches: [].',
  '- Never touch server-side secrets, .env, package.json, or lock files.',
  '- Prefer editing files that were passed in as context. If none match, set skip_reason.',
  'Respond with the JSON object only. No prose, no markdown fences.',
].join('\n');

async function planBugFix(bug: { id: number; body: string | null; page_url: string | null }): Promise<PlannerResult> {
  const candidates = guessCandidateFiles(bug);
  const contexts: Array<{ path: string; content: string }> = [];
  for (const p of candidates) {
    try {
      const file = await ghGetFile(p);
      if (file) {
        const trimmed = file.content.length > MAX_FILE_BYTES ? file.content.slice(0, MAX_FILE_BYTES) + '\n/* … truncated … */' : file.content;
        contexts.push({ path: p, content: trimmed });
      }
    } catch { /* skip missing */ }
  }
  const contextBlock = contexts.length === 0
    ? '(no candidate files fetched — you may need to set skip_reason)'
    : contexts.map((c) => `=== FILE: ${c.path} ===\n${c.content}\n=== END FILE ===`).join('\n\n');

  const prompt = [
    `BUG #${bug.id}`,
    `URL: ${bug.page_url ?? '(none)'}`,
    `REPORT: ${bug.body ?? '(empty)'}`,
    '',
    'CANDIDATE FILES:',
    contextBlock,
    '',
    'Return the JSON plan.',
  ].join('\n');

  const raw = await callAnthropic({ system: PLANNER_SYSTEM, prompt, maxTokens: 8000 });
  const parsed = parseJsonLoose(raw);
  const patches = Array.isArray(parsed.patches) ? (parsed.patches as unknown[]).filter((p): p is FilePatch => {
    const px = p as Partial<FilePatch>;
    return typeof px.path === 'string' && typeof px.new_content === 'string' && px.new_content.length > 0;
  }) : [];
  return {
    plan_md: typeof parsed.plan_md === 'string' ? parsed.plan_md : '',
    patches,
    skip_reason: typeof parsed.skip_reason === 'string' && parsed.skip_reason ? parsed.skip_reason : undefined,
    cost_usd: 0.05,
  };
}

const REVIEWER_SYSTEM = [
  'You are a strict code reviewer for a Next.js hotel BI app. Given a bug + proposed patches, return ONLY JSON:',
  '{ "verdict": "approve" | "reject" | "needs_human", "notes": "1-3 sentences" }',
  'APPROVE if: patches are minimal, safe, likely to fix the bug, no syntax issues, no design-token violations (no `var(--paper-warm)`).',
  'REJECT if: patches introduce bugs, break TS, remove needed code, add features.',
  'NEEDS_HUMAN if: patches attempt a page rewrite, touch >3 files, or bug is ambiguous.',
  'Be adversarial. Default to needs_human when in doubt.',
].join('\n');

async function reviewPlan(bug: { id: number; body: string | null }, plan: PlannerResult): Promise<ReviewerResult> {
  if (plan.patches.length === 0) return { verdict: 'needs_human', notes: 'Planner produced no patches.', cost_usd: 0 };
  if (plan.patches.length > 3) return { verdict: 'needs_human', notes: `Too many files (${plan.patches.length}), needs human.`, cost_usd: 0 };
  const patchSummary = plan.patches.map((p) => {
    const content = p.new_content.length > 15000
      ? p.new_content.slice(0, 15000) + '\n... (truncated at 15KB — file is ' + p.new_content.length + ' bytes total)'
      : p.new_content;
    return `--- ${p.path} (${p.new_content.length} bytes) ---\nRATIONALE: ${p.reasoning}\nFULL PATCHED CONTENT:\n${content}`;
  }).join('\n\n');
  const prompt = [
    `BUG #${bug.id}: ${bug.body ?? '(empty)'}`,
    `PLAN: ${plan.plan_md}`,
    `PATCHES (${plan.patches.length}):`,
    patchSummary,
  ].join('\n');
  const raw = await callAnthropic({ system: REVIEWER_SYSTEM, prompt, maxTokens: 500 });
  const parsed = parseJsonLoose(raw);
  const verdict = ['approve', 'reject', 'needs_human'].includes(String(parsed.verdict))
    ? (parsed.verdict as 'approve' | 'reject' | 'needs_human')
    : 'needs_human';
  return { verdict, notes: typeof parsed.notes === 'string' ? parsed.notes : '(no notes)', cost_usd: 0.01 };
}

function parseJsonLoose(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch {
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch { /* fall through */ } }
    return {};
  }
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

export async function runOneBug(bug: { id: number; body: string | null; page_url: string | null; dept_slug: string | null }, triggeredBy: string): Promise<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string; cost_usd?: number }> {
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
    const plan = await planBugFix(bug);
    costUsd += plan.cost_usd;
    await updateRun(runId, { planner_out: plan }, `PLAN · patches=${plan.patches.length} skip=${plan.skip_reason ?? '—'}`);
    if (plan.skip_reason || plan.patches.length === 0) {
      await updateRun(runId, { phase: 'needs_human', cost_usd: costUsd, ended_at: new Date().toISOString() }, `NEEDS_HUMAN · ${plan.skip_reason ?? 'no patches'}`);
      return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human', cost_usd: costUsd };
    }
    await updateRun(runId, { phase: 'reviewing' }, `REVIEW · calling Anthropic…`);
    const review = await reviewPlan(bug, plan);
    costUsd += review.cost_usd;
    await updateRun(runId, { reviewer_out: review }, `REVIEW · verdict=${review.verdict} · ${review.notes}`);
    if (review.verdict !== 'approve') {
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
    const success = verify.ci_ok === true && (verify.curl_body_ok !== false);
    // Determine best fix_link: PR URL if opened, else GH branch compare view
    const fixLink = ship.pr_url ?? `https://github.com/${GH_REPO}/compare/${GH_BASE_BRANCH}...${ship.branch}`;
    const fixLabel = ship.pr_number ? `PR #${ship.pr_number}` : `branch: ${ship.branch}`;
    if (success) {
      await markBug(bug.id, { status: 'in_progress', started_at: new Date().toISOString(), fix_link: fixLink, fix_label: fixLabel });
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

export async function pickBugs(opts: { bug_ids?: number[]; mode: 'one' | 'drain'; max: number }): Promise<Array<{ id: number; body: string | null; page_url: string | null; dept_slug: string | null }>> {
  const sb = getSupabaseAdmin();
  // PBS 2026-07-17 — READ from public.cockpit_bugs view (cockpit schema not
  // PostgREST-exposed). View exposes agent_skip via the underlying table.
  // PBS 2026-07-17 — v_bugs_ready_for_agent excludes bugs attempted in the
  // last 4h so drain doesn't re-pick the same 3 bugs every call.
  let q = sb.from('v_bugs_ready_for_agent')
    .select('id, body, page_url, dept_slug, status');
  if (opts.bug_ids && opts.bug_ids.length > 0) q = q.in('id', opts.bug_ids);
  q = q.order('created_at', { ascending: true }).limit(opts.mode === 'one' ? 1 : opts.max);
  const { data } = await q;
  return ((data ?? []) as Array<{ id: number; body: string | null; page_url: string | null; dept_slug: string | null }>);
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
