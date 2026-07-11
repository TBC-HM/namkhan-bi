// app/api/marketing/media/facility-ai-context-upsert/route.ts
// POST — upsert AI-grounding enrichment for one facility. Calls public.fn_facility_ai_context_upsert (SECURITY DEFINER).
// The route trusts nothing except facility_id — the RPC re-reads property_id from property.facilities so callers cannot spoof it.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const {
    facility_id,
    facility_key,
    ai_description,
    materials,
    view_direction,
    signature_elements,
    time_of_day_hint,
    active,
    sort_order,
    updated_by,
  } = body || {};

  if (!facility_id) return NextResponse.json({ error: 'missing_facility_id' }, { status: 400 });

  const payload = {
    facility_id: Number(facility_id),
    facility_key: facility_key ?? null,
    ai_description: ai_description ?? null,
    materials: Array.isArray(materials) ? materials : [],
    view_direction: view_direction ?? null,
    signature_elements: Array.isArray(signature_elements) ? signature_elements : [],
    time_of_day_hint: time_of_day_hint ?? null,
    active: active !== false,
    sort_order: sort_order != null ? Number(sort_order) : 100,
    updated_by: updated_by ?? 'media-settings-ui',
  };

  try {
    const { data, error } = await sb.rpc('fn_facility_ai_context_upsert', { p: payload });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ facility_id: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
