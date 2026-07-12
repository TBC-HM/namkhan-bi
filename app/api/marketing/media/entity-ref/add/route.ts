// app/api/marketing/media/entity-ref/add/route.ts
// POST — link a media asset to an entity (room/facility/activity/certification)
// as either an AI reference (used by generator as visual anchor) or a Human reference (staff).
// PBS 2026-07-12 — powers the "Link photos" widget in Settings.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set(['room','facility','activity','certification']);
const LANES = new Set(['ai','human']);

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: { property_id?: number; entity_kind?: string; entity_ref?: string; asset_id?: string;
              reference_lane?: string; notes?: string; sort_order?: number; created_by?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, entity_kind, entity_ref, asset_id, reference_lane, notes, sort_order, created_by } = body || {};
  if (!property_id || !entity_kind || !entity_ref || !asset_id) {
    return NextResponse.json({ error: 'missing_fields', need: ['property_id','entity_kind','entity_ref','asset_id'] }, { status: 400 });
  }
  if (!KINDS.has(String(entity_kind))) return NextResponse.json({ error: 'bad_entity_kind', allowed: Array.from(KINDS) }, { status: 400 });
  const lane = reference_lane ?? 'ai';
  if (!LANES.has(String(lane))) return NextResponse.json({ error: 'bad_reference_lane', allowed: Array.from(LANES) }, { status: 400 });

  const { data, error } = await sb.rpc('fn_entity_reference_asset_add', {
    p_property_id:    Number(property_id),
    p_entity_kind:    String(entity_kind),
    p_entity_ref:     String(entity_ref),
    p_asset_id:       String(asset_id),
    p_reference_lane: String(lane),
    p_notes:          notes ?? null,
    p_sort_order:     Number(sort_order ?? 0),
    p_created_by:     created_by ?? 'PBS',
  });
  if (error) return NextResponse.json({ error: 'add_failed', detail: error.message, code: error.code, hint: error.hint }, { status: 500 });
  return NextResponse.json({ ok: true, id: data });
}
