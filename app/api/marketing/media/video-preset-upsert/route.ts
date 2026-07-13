// app/api/marketing/media/video-preset-upsert/route.ts
// PBS 2026-07-13 · Video AI Studio v1 — style-preset upsert.
// Writes to marketing.video_style_presets via SECURITY DEFINER RPC.
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

  const payload = {
    property_id: body.property_id ?? null,
    channel: body.channel,
    preset_key: body.preset_key,
    playlist_id: body.playlist_id ?? null,
    opener_config: body.opener_config ?? {},
    closer_config: body.closer_config ?? {},
    music_mood: body.music_mood ?? null,
    voice_id: body.voice_id ?? null,
    transition_style: body.transition_style ?? null,
    avg_shot_duration_sec: body.avg_shot_duration_sec ?? 3.5,
    active: body.active ?? true,
  };
  if (!payload.channel || !payload.preset_key) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_video_style_preset_upsert', { p: payload as any });
  if (error) return NextResponse.json({ error: 'upsert_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}
