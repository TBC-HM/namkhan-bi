// app/api/marketing/media/room-ai-context/upsert/route.ts
// POST — upsert an editable room AI-grounding description via SECURITY DEFINER RPC.
// Consumed by SettingsTab (Rooms panel). Field-level COALESCE — send only changed fields.
// PBS 2026-07-12.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  property_id?: number;
  room_type_id?: number;
  ai_description?: string | null;
  materials?: string[] | null;
  signature_elements?: string[] | null;
  view_direction?: string | null;
  time_of_day_hint?: string | null;
  active?: boolean | null;
  sort_order?: number | null;
  updated_by?: string | null;
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const property_id  = Number(body?.property_id);
  const room_type_id = Number(body?.room_type_id);
  if (!Number.isFinite(property_id) || property_id <= 0)   return NextResponse.json({ error: 'property_id required' }, { status: 400 });
  if (!Number.isFinite(room_type_id) || room_type_id <= 0) return NextResponse.json({ error: 'room_type_id required' }, { status: 400 });

  const { data, error } = await sb.rpc('fn_room_ai_context_upsert', {
    p_property_id:        property_id,
    p_room_type_id:       room_type_id,
    p_ai_description:     body.ai_description     ?? null,
    p_materials:          body.materials          ?? null,
    p_signature_elements: body.signature_elements ?? null,
    p_view_direction:     body.view_direction     ?? null,
    p_time_of_day_hint:   body.time_of_day_hint   ?? null,
    p_active:             body.active             ?? null,
    p_sort_order:         body.sort_order         ?? null,
    p_updated_by:         body.updated_by         ?? 'PBS',
  });
  if (error) return NextResponse.json({ error: 'upsert_failed', detail: error.message, code: error.code, hint: error.hint }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}
