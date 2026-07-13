// app/api/marketing/media/qa-stats/route.ts
// Iris skill handler: query_qa_stats.
// GET ?period=30d&tier=hero — wraps public.fn_qa_stats.
// PBS 2026-07-14.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const period = req.nextUrl.searchParams.get('period') ?? '30d';
  const tier   = req.nextUrl.searchParams.get('tier');

  const { data, error } = await sb.rpc('fn_qa_stats', { p_period: period, p_tier: tier });
  if (error) return NextResponse.json({ ok: false, error: 'rpc_failed', detail: error.message }, { status: 500 });

  try {
    await sb.rpc('fn_log_skill_call', {
      p_role: 'mkt_qa_photo',
      p_skill: 'query_qa_stats',
      p_status: 'ok',
      p_duration_ms: Date.now() - t0,
      p_cost_milli: 0,
      p_input: { period, tier },
      p_output: data,
    });
  } catch {}

  return NextResponse.json({ ok: true, data });
}
