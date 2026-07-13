// app/api/marketing/media/video-brief-create/route.ts
// PBS 2026-07-13 · Phase 2 unified video pipeline — create a video brief.
// POST body: { property_id, title, angle?, target_channels[], target_pillars?[],
//              duration_target_sec?, notes?, origin?, origin_ref_id? }
// Calls SECURITY DEFINER RPC public.fn_video_brief_create; returns { ok, id }.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  property_id: number;
  title: string;
  angle?: string | null;
  target_channels: string[];
  target_pillars?: string[] | null;
  duration_target_sec?: number | null;
  notes?: string | null;
  origin?: string | null;
  origin_ref_id?: string | null;
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: Payload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { property_id, title, target_channels } = body || ({} as Payload);
  if (!property_id) return NextResponse.json({ error: 'property_id_required' }, { status: 400 });
  if (!title || !title.trim()) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  if (!Array.isArray(target_channels) || target_channels.length === 0) {
    return NextResponse.json({ error: 'target_channels_required' }, { status: 400 });
  }

  const origin = body.origin ?? 'manual_media_studio';
  if (!['yt_title_calendar','manual_media_studio','campaign_ask'].includes(origin)) {
    return NextResponse.json({ error: 'origin_invalid' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_video_brief_create', {
    p_property_id: property_id,
    p_title: title.trim(),
    p_angle: body.angle ?? null,
    p_target_channels: target_channels,
    p_origin: origin,
    p_origin_ref_id: body.origin_ref_id ?? null,
    p_target_pillars: body.target_pillars ?? null,
    p_duration_target_sec: body.duration_target_sec ?? null,
    p_notes: body.notes ?? null,
  });
  if (error) return NextResponse.json({ error: 'brief_create_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data });
}
