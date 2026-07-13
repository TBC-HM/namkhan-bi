// app/api/marketing/media/asset-video-meta/route.ts
// POST — write client-extracted video metadata via SECURITY DEFINER RPC.
// Body: { asset_id, duration_sec, width_px, height_px, has_audio }
// PBS 2026-07-13 · Task D — client browser probes <video> then reports back.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const asset_id = body?.asset_id;
  if (!asset_id || typeof asset_id !== 'string' || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const duration_sec = body.duration_sec != null && !Number.isNaN(Number(body.duration_sec)) ? Number(body.duration_sec) : null;
  const width_px  = body.width_px  != null && !Number.isNaN(Number(body.width_px))  ? Math.round(Number(body.width_px))  : null;
  const height_px = body.height_px != null && !Number.isNaN(Number(body.height_px)) ? Math.round(Number(body.height_px)) : null;
  const has_audio = body.has_audio == null ? null : Boolean(body.has_audio);

  try {
    const { data, error } = await sb.rpc('fn_media_asset_video_meta_update', {
      p_asset_id: asset_id,
      p_duration_sec: duration_sec,
      p_width_px: width_px,
      p_height_px: height_px,
      p_has_audio: has_audio,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    const res = data as any;
    if (!res?.ok) return NextResponse.json({ error: res?.error ?? 'update_failed' }, { status: 400 });
    return NextResponse.json({ ok: true, asset: res.asset });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
