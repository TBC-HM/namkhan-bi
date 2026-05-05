// app/api/compiler/runs/[id]/offer/route.ts
// PATCH { window_from, window_to, room_type_ids, rate_plan_id }
//   -> updates compiler.runs.parsed_spec.offer, then rebuilds variants
//   -> returns { variants, breakdown }
//
// Calling this multiple times re-runs the build idempotently.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildVariants } from '@/lib/compiler/variants';
import type { ParsedSpec } from '@/lib/compiler/parse';
import { DEFAULT_RATE_PLAN_ID } from '@/lib/compiler/roomPricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { window_from, window_to, room_type_ids, rate_plan_id } = body;
    if (!window_from || !window_to) {
      return NextResponse.json({ error: 'window_from + window_to required' }, { status: 400 });
    }
    if (!Array.isArray(room_type_ids) || room_type_ids.length === 0) {
      return NextResponse.json({ error: 'room_type_ids[] required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const id = params.id;
    const { data: run, error: getErr } = await admin
      .schema('compiler')
      .from('runs')
      .select('id, parsed_spec')
      .eq('id', id)
      .maybeSingle();
    if (getErr || !run) return NextResponse.json({ error: 'run not found' }, { status: 404 });

    const spec = (run.parsed_spec ?? {}) as ParsedSpec;
    spec.offer = {
      window_from,
      window_to,
      room_type_ids: room_type_ids.map((n: any) => Number(n)),
      rate_plan_id: Number(rate_plan_id) || DEFAULT_RATE_PLAN_ID,
    };

    const { error: updErr } = await admin
      .schema('compiler')
      .from('runs')
      .update({ parsed_spec: spec, status: 'compiling' })
      .eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const variants = await buildVariants(spec);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'no variants — likely no rate_inventory rows for this combination' }, { status: 422 });
    }

    // Preserve operator discounts across rebuilds by label
    const { data: prev } = await admin
      .schema('compiler').from('variants')
      .select('label, operator_discount_usd').eq('run_id', id);
    const discountByLabel = new Map<string, number>(
      (prev ?? []).map((r: any) => [r.label, Number(r.operator_discount_usd ?? 0)]),
    );

    // wipe + insert
    await admin.schema('compiler').from('variants').delete().eq('run_id', id);
    const rows = variants.map(v => ({
      run_id: id,
      label: v.label,
      room_category: v.room_category,
      activity_intensity: v.activity_intensity,
      fnb_mode: v.fnb_mode,
      total_usd: v.total_usd,
      per_pax_usd: v.per_pax_usd,
      margin_pct: v.margin_pct,
      occ_assumption_pct: v.occ_assumption_pct,
      day_structure: v.day_structure,
      usali_split: { ...v.usali_split, _breakdown: v.pricing_breakdown },
      bookable_rooms: v.bookable_rooms,
      bookable_boards: v.bookable_boards,
      bookable_program: v.bookable_program,
      bookable_addons: v.bookable_addons,
      recommended: v.recommended,
      operator_discount_usd: discountByLabel.get(v.label) ?? 0,
      rate_plan_id: v.rate_plan_id,
      rate_plan_name: v.rate_plan_name,
      room_rate_median_usd: v.room_rate_median_usd,
      room_rate_min_usd: v.room_rate_min_usd,
      room_rate_max_usd: v.room_rate_max_usd,
      room_rate_days: v.room_rate_days,
    }));
    const { error: insErr } = await admin.schema('compiler').from('variants').insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    await admin.schema('compiler').from('runs').update({ status: 'ready' }).eq('id', id);

    return NextResponse.json({ runId: id, variants, count: variants.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
