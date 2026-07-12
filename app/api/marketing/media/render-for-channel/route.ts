// app/api/marketing/media/render-for-channel/route.ts
// POST { asset_id, channel, property_id } — resolve a channel-sized download URL
// via Supabase Storage image transformation. No worker needed — the transform
// happens at CDN edge on first hit. PBS 2026-07-12: rewritten (v6) after PBS
// discovered "queued as render" banner produced no downloadable file (render-media
// edge fn never existed; old route pretended to queue).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://kpenyneooigsyuuomgct.supabase.co';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: { asset_id?: string; channel?: string; property_id?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { asset_id, channel } = body || {};
  if (!asset_id || !channel) {
    return NextResponse.json({ error: 'missing_fields', need: ['asset_id','channel'] }, { status: 400 });
  }

  // Channel spec = target dimensions
  const { data: spec, error: specErr } = await sb.from('v_media_channel_specs')
    .select('channel, display_name, image_min_width, image_min_height, image_required_formats')
    .eq('channel', channel).maybeSingle();
  if (specErr || !spec) return NextResponse.json({ error: 'unknown_channel', channel }, { status: 400 });

  // Asset — need master_path + is_ai_generated to pick the right bucket
  const { data: asset, error: assetErr } = await sb.from('v_marketing_media_page')
    .select('asset_id, original_filename, master_path, is_ai_generated, mime_type')
    .eq('asset_id', asset_id).maybeSingle();
  if (assetErr || !asset || !asset.master_path) {
    return NextResponse.json({ error: 'asset_not_found_or_no_master_path' }, { status: 404 });
  }

  const bucket = asset.is_ai_generated ? 'media-ai' : 'media-renders';
  const width  = Number(spec.image_min_width) || 1920;
  const height = Number(spec.image_min_height) || 1080;
  const fmt    = (Array.isArray(spec.image_required_formats) && spec.image_required_formats[0]) || 'jpeg';
  const quality = 85;

  // Supabase Storage image transformation URL — resize to spec, cover-crop, deliver as jpeg/webp.
  // See: https://supabase.com/docs/guides/storage/serving/image-transformations
  const encPath = encodeURI(asset.master_path).replace(/#/g, '%23');
  const download_url = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${encPath}?width=${width}&height=${height}&resize=cover&quality=${quality}&format=${fmt === 'webp' ? 'origin' : 'origin'}`;
  const preview_url  = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${encPath}?width=800&height=${Math.round(800 * height / width)}&resize=cover&quality=70`;

  return NextResponse.json({
    ok: true,
    channel: spec.channel,
    channel_display: spec.display_name,
    width, height, format: fmt, quality,
    download_url,
    preview_url,
    filename_hint: `${(asset.original_filename ?? asset_id).replace(/\.[a-z0-9]+$/i, '')}_${channel}_${width}x${height}.jpg`,
  });
}
