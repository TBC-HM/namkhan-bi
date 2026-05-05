// app/api/compiler/build/route.ts
// POST { runId } -> reads parsed spec, generates 2-3 variants, persists them.
import { NextRequest, NextResponse } from 'next/server';
import { buildVariants } from '@/lib/compiler/variants';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { ParsedSpec } from '@/lib/compiler/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { runId } = await req.json().catch(() => ({}));
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: run, error: runErr } = await admin
      .schema('compiler')
      .from('runs')
      .select('id, parsed_spec, status')
      .eq('id', runId)
      .single();
    if (runErr || !run) return NextResponse.json({ error: runErr?.message ?? 'run not found' }, { status: 404 });

    const spec = run.parsed_spec as ParsedSpec;
    const variants = await buildVariants(spec);

    if (variants.length === 0) {
      // No offer config yet — parser created the run but the operator still
      // needs to pick window + rooms + rate plan in the UI.
      return NextResponse.json({
        runId,
        variants: [],
        count: 0,
        needsOfferConfig: true,
        message: 'Parsed. Set offer window + room types in the UI to generate priced variants.',
      });
    }

    // wipe + insert (idempotent rebuild)
    await admin.schema('compiler').from('variants').delete().eq('run_id', runId);
    const rows = variants.map(v => ({
      run_id: runId,
      label: v.label,
      room_category: v.room_category,
      activity_intensity: v.activity_intensity,
      fnb_mode: v.fnb_mode,
      total_usd: v.total_usd,
      per_pax_usd: v.per_pax_usd,
      margin_pct: v.margin_pct,
      occ_assumption_pct: v.occ_assumption_pct,
      day_structure: v.day_structure,
      usali_split: v.usali_split,
      bookable_rooms: v.bookable_rooms,
      bookable_boards: v.bookable_boards,
      bookable_program: v.bookable_program,
      bookable_addons: v.bookable_addons,
      recommended: v.recommended,
    }));
    const { error: insErr } = await admin.schema('compiler').from('variants').insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    await admin.schema('compiler').from('runs').update({ status: 'ready' }).eq('id', runId);

    return NextResponse.json({ runId, variants, count: variants.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
