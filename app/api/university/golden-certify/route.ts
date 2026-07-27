// app/api/university/golden-certify/route.ts
// TBC University · golden record certification (owner act, conformance
// battery A5). Wraps public.fn_kpi_golden_certify (SECURITY DEFINER,
// service_role-only EXECUTE) — marks a kpi.golden_values row certified,
// optionally re-snapshotting the expected value at certification time
// (July-still-posting caveat in the brief).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    golden_id?: number;
    certified_by?: string;
    expected_value?: number | null;
  };
  const goldenId = Number(body.golden_id);
  const certifiedBy = String(body.certified_by ?? 'PBS').trim().slice(0, 80) || 'PBS';
  const expected = body.expected_value == null ? null : Number(body.expected_value);
  if (!Number.isInteger(goldenId) || goldenId <= 0) {
    return NextResponse.json({ ok: false, error: 'golden_id required' }, { status: 400 });
  }
  if (expected != null && !Number.isFinite(expected)) {
    return NextResponse.json({ ok: false, error: 'expected_value must be numeric' }, { status: 400 });
  }
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_kpi_golden_certify', {
      p_golden_id: goldenId,
      p_certified_by: certifiedBy,
      p_expected_value: expected,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, result: data ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'certify failed' },
      { status: 500 },
    );
  }
}
