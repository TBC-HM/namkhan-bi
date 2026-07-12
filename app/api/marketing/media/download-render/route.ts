// app/api/marketing/media/download-render/route.ts
// GET ?asset_id=…&channel=… — server-side proxy that streams the channel-sized image
// back to the browser with Content-Disposition: attachment so it downloads instead
// of opening in a new tab. Cross-origin URLs ignore <a download="…"> so this proxy is required.
// PBS 2026-07-12 pm.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://kpenyneooigsyuuomgct.supabase.co';

export async function GET(req: NextRequest) {
  const asset_id = req.nextUrl.searchParams.get('asset_id');
  const channel  = req.nextUrl.searchParams.get('channel');
  if (!asset_id || !channel) return NextResponse.json({ error: 'asset_id + channel required' }, { status: 400 });

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  const { data: spec } = await sb.from('v_media_channel_specs')
    .select('channel, image_min_width, image_min_height, image_required_formats')
    .eq('channel', channel).maybeSingle();
  if (!spec) return NextResponse.json({ error: 'unknown_channel' }, { status: 400 });

  const { data: asset } = await sb.from('v_marketing_media_page')
    .select('asset_id, original_filename, master_path, is_ai_generated, mime_type')
    .eq('asset_id', asset_id).maybeSingle();
  if (!asset?.master_path) return NextResponse.json({ error: 'asset_not_found' }, { status: 404 });

  const bucket = asset.is_ai_generated ? 'media-ai' : 'media-renders';
  const width  = Number(spec.image_min_width) || 1920;
  const height = Number(spec.image_min_height) || 1080;
  const encPath = encodeURI(asset.master_path).replace(/#/g, '%23');
  const transformUrl = `${SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${encPath}?width=${width}&height=${height}&resize=cover&quality=85`;

  // Fetch server-side
  const upstream = await fetch(transformUrl);
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json({ error: 'upstream_fetch_failed', status: upstream.status, detail: detail.slice(0, 200) }, { status: 502 });
  }
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  const base = (asset.original_filename ?? asset_id).replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const filename = `${base}_${channel}_${width}x${height}.jpg`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0',
    },
  });
}
