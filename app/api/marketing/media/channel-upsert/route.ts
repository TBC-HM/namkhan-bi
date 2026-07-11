// app/api/marketing/media/channel-upsert/route.ts
// POST — update editable fields on a media.media_channel_specs row via public.fn_media_channel_spec_upsert (SECURITY DEFINER).
// Body: { channel, image_min_width?, image_min_height?, image_aspect_ratio?, image_max_size_mb?,
//         video_min_duration_sec?, video_max_duration_sec?, video_aspect_ratio?, video_max_size_mb?, notes? }
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

  if (!body?.channel) return NextResponse.json({ error: 'missing_channel' }, { status: 400 });

  // Whitelist editable columns; RPC will ignore anything else.
  const p: Record<string, any> = { channel: body.channel };
  const cols = [
    'image_min_width','image_min_height','image_aspect_ratio','image_max_size_mb',
    'video_min_duration_sec','video_max_duration_sec','video_aspect_ratio','video_max_size_mb','notes',
  ];
  for (const c of cols) if (body[c] !== undefined) p[c] = body[c] === null ? '' : String(body[c]);

  try {
    const { data, error } = await sb.rpc('fn_media_channel_spec_upsert', { p });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, channel: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
