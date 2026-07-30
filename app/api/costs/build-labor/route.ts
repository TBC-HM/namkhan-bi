// app/api/costs/build-labor/route.ts
// Cost Governance v1.5 (brief cost-governance-v1 · ADR-196 full ledger now):
// PBS build-hours entry. Wrapper over public.fn_costs_log_build_labor
// (SECURITY DEFINER bridge — PostgREST public-only law). Rate defaults to the
// effective-dated price-book labor rate at work_date; the bridge ingests the
// row into the ledger immediately (work_class platform_build, capex_candidate).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  work_date?: string;         // 'YYYY-MM-DD'
  hours?: number;
  actor?: string;
  initiative?: string;
  module_key?: string;
  rate_usd_per_hour?: number | null;
  note?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const workDate = String(body.work_date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return NextResponse.json({ ok: false, error: 'work_date_required (YYYY-MM-DD)' }, { status: 400 });
  }
  const hours = Number(body.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return NextResponse.json({ ok: false, error: 'hours_must_be_0_to_24' }, { status: 400 });
  }
  const rate = body.rate_usd_per_hour == null ? null : Number(body.rate_usd_per_hour);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_costs_log_build_labor', {
    p_work_date: workDate,
    p_hours: hours,
    p_actor: String(body.actor ?? 'PBS').trim() || 'PBS',
    p_initiative: String(body.initiative ?? '').trim() || null,
    p_module_key: String(body.module_key ?? '').trim() || null,
    p_rate_usd_per_hour: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
    p_note: String(body.note ?? '').trim() || null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const j = (data ?? {}) as { ok?: boolean; error?: string };
  return NextResponse.json(j, { status: j.ok ? 200 : 400 });
}
