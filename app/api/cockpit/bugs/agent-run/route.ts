// app/api/cockpit/bugs/agent-run/route.ts
// PBS 2026-07-17 — Bug-agent orchestrator (thin route, orchestration in
// lib/bugAgent.ts so /api/cron/bug-agent-drain can share it).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { runAgentJob } from '@/lib/bugAgent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    bug_ids?: number[]; mode?: 'one' | 'drain'; max?: number; triggered_by?: string;
  };
  const result = await runAgentJob({
    bug_ids: body.bug_ids,
    mode: body.mode ?? 'one',
    max: body.max ?? 1,
    triggered_by: body.triggered_by ?? 'ui',
  });
  return NextResponse.json({ phase: 'B', ...result });
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
