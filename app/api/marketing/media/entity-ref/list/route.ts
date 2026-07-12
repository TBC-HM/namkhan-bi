// app/api/marketing/media/entity-ref/list/route.ts
// GET ?property_id=... — return all reference-photo links for a property.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pid = Number(req.nextUrl.searchParams.get('property_id') ?? 260955);
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
  const { data, error } = await sb.from('v_entity_reference_assets')
    .select('id, entity_kind, entity_ref, asset_id, reference_lane, sort_order, original_filename, public_url, created_at')
    .eq('property_id', pid)
    .order('entity_kind', { ascending: true })
    .order('entity_ref', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [], count: (data ?? []).length });
}
