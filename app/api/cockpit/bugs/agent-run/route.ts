// app/api/cockpit/bugs/agent-run/route.ts
// PBS 2026-07-17 — Bug-agent orchestrator (Phase A · shell + audit trail).
//
// POST /api/cockpit/bugs/agent-run
//   body: { bug_ids?: number[]; mode?: 'one'|'drain'; max?: number; dry_run?: boolean }
// GET  /api/cockpit/bugs/agent-run?run_id=...  (returns latest state)
//
// PHASE A: walks all 5 phases (planning → reviewing → shipping → verifying →
// closing) with realistic delays, writes every transition to
// cockpit.bug_agent_runs, but marks the bug 'needs_human' at the end with a
// placeholder plan. NO code is pushed to main in Phase A. This is a working
// shell that lets PBS watch the loop on /holding/bugs before we swap in real
// Anthropic + GitHub push in Phase B.
//
// Safety already baked in:
//  - agent_skip=true bugs are silently ignored (auto-classified rewrites)
//  - max defaults to 5, hard cap 10 per invocation
//  - triggered_by tracked (cron|ui|manual)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel serverless upper bound for hobby/pro

interface RunPatch {
  phase?: string;
  branch?: string | null;
  pr_number?: number | null;
  pr_url?: string | null;
  commit_sha?: string | null;
  planner_out?: unknown;
  reviewer_out?: unknown;
  verifier_out?: unknown;
  cost_usd?: number;
  log_md?: string;
  ended_at?: string | null;
  error?: string | null;
}

async function updateRun(runId: number, patch: RunPatch, appendLog?: string) {
  const sb = getSupabaseAdmin();
  const nextPatch: Record<string, unknown> = { ...patch };
  if (appendLog) {
    const { data: prev } = await sb.schema('cockpit').from('bug_agent_runs').select('log_md').eq('id', runId).maybeSingle();
    const prior = ((prev as { log_md: string } | null)?.log_md ?? '');
    nextPatch.log_md = prior + `[${new Date().toISOString()}] ${appendLog}\n`;
  }
  await sb.schema('cockpit').from('bug_agent_runs').update(nextPatch).eq('id', runId);
}

async function markBug(bugId: number, patch: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  await sb.schema('cockpit').from('exec_bugs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', bugId);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function runOneBug(bug: { id: number; body: string | null; page_url: string | null; dept_slug: string | null }, triggeredBy: string) {
  const sb = getSupabaseAdmin();
  // Create run row.
  const { data: runRow, error: insErr } = await sb
    .schema('cockpit')
    .from('bug_agent_runs')
    .insert({
      bug_id: bug.id,
      triggered_by: triggeredBy,
      phase: 'planning',
      log_md: `[${new Date().toISOString()}] START · bug=${bug.id} url=${bug.page_url ?? '(none)'}\n`,
    })
    .select('id')
    .single();
  if (insErr || !runRow) {
    console.error('[bug-agent] run insert failed', insErr);
    return { bug_id: bug.id, ok: false, error: insErr?.message ?? 'insert_failed' };
  }
  const runId = (runRow as { id: number }).id;

  try {
    // ---- PHASE 1: PLANNING ---------------------------------------------
    await updateRun(runId, { phase: 'planning' }, `PLAN · analyzing bug body (${(bug.body ?? '').slice(0, 80)}…)`);
    await sleep(1500); // simulates ~AI planner latency

    const stubPlan = {
      summary: 'Phase A stub · real planner will run in Phase B',
      likely_files: bug.page_url ? guessFiles(bug.page_url) : [],
      patches: [] as Array<{ path: string; snippet: string }>,
    };
    await updateRun(runId, { planner_out: stubPlan }, `PLAN · stub plan produced (0 patches). Real Anthropic call in Phase B.`);

    // ---- PHASE 2: REVIEWING --------------------------------------------
    await updateRun(runId, { phase: 'reviewing' }, `REVIEW · second agent inspecting plan…`);
    await sleep(1200);
    const stubReview = { verdict: 'needs_human', notes: 'Phase A: no patches produced; deferring to human until Phase B ships.' };
    await updateRun(runId, { reviewer_out: stubReview }, `REVIEW · verdict=${stubReview.verdict}`);

    // ---- PHASE 3: SHIPPING (SKIPPED IN PHASE A) ------------------------
    await updateRun(runId, { phase: 'shipping' }, `SHIP · skipped in Phase A (no patches).`);
    await sleep(500);

    // ---- PHASE 4: VERIFYING (SKIPPED IN PHASE A) -----------------------
    await updateRun(runId, { phase: 'verifying' }, `VERIFY · skipped in Phase A.`);
    await sleep(500);

    // ---- PHASE 5: CLOSING ----------------------------------------------
    await updateRun(runId, {
      phase: 'needs_human',
      ended_at: new Date().toISOString(),
    }, `DONE · Phase A end. Bug flagged needs_human until Phase B ships the real planner.`);
    // Do NOT touch bug status in Phase A — keep it 'new' so PBS still sees it in the queue.
    return { bug_id: bug.id, run_id: runId, ok: true, phase: 'needs_human' };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await updateRun(runId, { phase: 'failed', ended_at: new Date().toISOString(), error: err }, `FAIL · ${err}`);
    return { bug_id: bug.id, run_id: runId, ok: false, error: err };
  }
}

function guessFiles(pageUrl: string): string[] {
  try {
    const u = new URL(pageUrl);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (!seg) return [];
    return [`app/${seg}/**`, `components/${seg}/**`, `lib/${seg}*.ts`];
  } catch { return []; }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    bug_ids?: number[];
    mode?: 'one' | 'drain';
    max?: number;
    triggered_by?: string;
  };
  const mode = body.mode ?? 'drain';
  const max = Math.min(Math.max(1, body.max ?? 5), 10);
  const triggeredBy = body.triggered_by ?? 'ui';

  const sb = getSupabaseAdmin();

  // Resolve bug set.
  let q = sb.schema('cockpit').from('exec_bugs')
    .select('id, body, page_url, dept_slug, status, agent_skip')
    .in('status', ['new', 'acknowledged'])
    .eq('agent_skip', false);
  if (body.bug_ids && body.bug_ids.length > 0) {
    q = q.in('id', body.bug_ids);
  }
  q = q.order('created_at', { ascending: true }).limit(mode === 'one' ? 1 : max);
  const { data: bugs, error: bugsErr } = await q;
  if (bugsErr) return NextResponse.json({ error: 'bug_query_failed', detail: bugsErr.message }, { status: 500 });

  const rows = (bugs ?? []) as Array<{ id: number; body: string | null; page_url: string | null; dept_slug: string | null }>;
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, message: 'No eligible bugs (all done, skipped, or filtered).', processed: [] });
  }

  const results: Array<{ bug_id: number; run_id?: number; ok: boolean; phase?: string; error?: string }> = [];
  for (const bug of rows) {
    const r = await runOneBug(bug, triggeredBy);
    results.push(r);
  }

  return NextResponse.json({
    ok: true,
    phase: 'A',
    mode,
    processed: results,
    note: 'Phase A shell — every bug ends needs_human; Phase B swaps in real Anthropic planner.',
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('run_id');
  const sb = getSupabaseAdmin();
  if (runId) {
    const { data } = await sb.schema('cockpit').from('bug_agent_runs').select('*').eq('id', Number(runId)).maybeSingle();
    return NextResponse.json({ run: data ?? null });
  }
  // Otherwise: return latest run per bug.
  const { data } = await sb.from('v_bug_agent_runs_latest').select('*').order('started_at', { ascending: false }).limit(50);
  return NextResponse.json({ runs: data ?? [] });
}
