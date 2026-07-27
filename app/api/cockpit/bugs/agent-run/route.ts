// app/api/cockpit/bugs/agent-run/route.ts
// PBS 2026-07-17 — Bug-agent orchestrator (thin route, orchestration in
// lib/bugAgent.ts so /api/cron/bug-agent-drain can share it).
//
// PBS 2026-07-27 — FIRE-AND-FORGET. The old POST awaited the whole run
// (plan → review → ship → CI-poll), so the browser request sat open for
// minutes and died in Vercel's timeout ("Unexpected token 'A'", bug 105)
// even when the work itself succeeded. Now: respond 202 immediately with
// queue position + rough ETA, run the job in the background via waitUntil,
// and let the UI's 2s poll on GET watch the run to its terminal phase.

import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { runAgentJob } from '@/lib/bugAgent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Observed full-loop wall time per bug ≈ 4 min (bug 105: fire → PR in 4 min).
const MINUTES_PER_BUG = 4;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    bug_ids?: number[]; mode?: 'one' | 'drain'; max?: number; triggered_by?: string;
  };

  // Queue snapshot: runs already in flight right now.
  const sb = getSupabaseAdmin();
  const { count } = await sb
    .schema('cockpit')
    .from('bug_agent_runs')
    .select('id', { count: 'exact', head: true })
    .is('ended_at', null);
  const inFlight = count ?? 0;
  const queuePosition = inFlight + 1;

  waitUntil(
    runAgentJob({
      bug_ids: body.bug_ids,
      mode: body.mode ?? 'one',
      max: body.max ?? 1,
      triggered_by: body.triggered_by ?? 'ui',
    }).catch((e) => {
      console.error('[bug-agent] background run failed:', e);
    }),
  );

  return NextResponse.json(
    {
      phase: 'B',
      accepted: true,
      fire_and_forget: true,
      bug_ids: body.bug_ids ?? null,
      mode: body.mode ?? 'one',
      queue_position: queuePosition,
      eta_minutes: queuePosition * MINUTES_PER_BUG,
    },
    { status: 202 },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('run_id');
  const sb = getSupabaseAdmin();
  if (runId) {
    const { data } = await sb.schema('cockpit').from('bug_agent_runs').select('*').eq('id', Number(runId)).maybeSingle();
    return NextResponse.json({ run: data ?? null });
  }
  const { data } = await sb.from('v_bug_agent_runs_latest').select('*').order('started_at', { ascending: false }).limit(50);
  return NextResponse.json({ runs: data ?? [] });
}
