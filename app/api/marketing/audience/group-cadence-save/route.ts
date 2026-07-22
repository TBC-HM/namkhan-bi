// app/api/marketing/audience/group-cadence-save/route.ts
// PBS 2026-07-22 · Save per-group newsletter cadence.
// POST { slug, cadence_per_month } → fn_group_cadence_upsert → returns new value.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug ?? '').trim();
  const cadence = Number(body?.cadence_per_month);
  if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });
  if (!Number.isFinite(cadence) || cadence < 0 || cadence > 30) {
    return NextResponse.json({ ok: false, error: 'cadence_per_month must be 0..30' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_group_cadence_upsert', { p_slug: slug, p_cadence_per_month: cadence });
  // (renamed 2026-07-22: p_cadence_per_week → p_cadence_per_month)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cadence_per_month: data });
}
