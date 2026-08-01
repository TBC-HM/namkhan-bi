// app/api/onboarding/set-task/route.ts
// Marks an onboarding task done/skipped/blocked via fn_onboarding_set_task
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    case_id: string;
    task_code: string;
    status: 'done' | 'skipped' | 'blocked' | 'not_started';
    evidence_url?: string;
    blocked_reason?: string;
    actor?: string;
  };

  if (!body.case_id || !body.task_code || !body.status) {
    return NextResponse.json({ error: 'case_id, task_code, status required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_onboarding_set_task', {
    p_case_id: body.case_id,
    p_task_code: body.task_code,
    p_status: body.status,
    p_evidence_url: body.evidence_url ?? null,
    p_blocked_reason: body.blocked_reason ?? null,
    p_actor: body.actor ?? 'pbs',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
