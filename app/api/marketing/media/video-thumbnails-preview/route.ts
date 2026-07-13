// app/api/marketing/media/video-thumbnails-preview/route.ts
// PBS 2026-07-13 · Video AI Studio v1 — thumbnail preview iterator.
// POST { asset_id, title, tagline?, primary_color? } →
//   { thumbnails: [{ channel, url, width, height }, ...] }
// Fast, does not touch Shotstack. Useful when PBS tweaks the title/tagline
// after picking shots.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateThumbnails, ensureBucket } from '@/lib/video/thumbnailGenerator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  asset_id: string;
  title?: string;
  tagline?: string;
  primary_color?: string;
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: Payload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.asset_id) return NextResponse.json({ error: 'asset_id_required' }, { status: 400 });

  // Look up source url.
  const { data: row, error } = await sb.from('v_marketing_media_page')
    .select('asset_id, public_url, original_filename')
    .eq('asset_id', body.asset_id).maybeSingle();
  if (error) return NextResponse.json({ error: 'asset_lookup_failed', detail: error.message }, { status: 500 });
  if (!row || !(row as any).public_url) return NextResponse.json({ error: 'asset_no_public_url' }, { status: 404 });

  await ensureBucket('media-thumbnails');

  try {
    const thumbnails = await generateThumbnails(
      (row as any).public_url,
      body.title ?? 'THE NAMKHAN',
      body.tagline ?? 'Luang Prabang · Laos',
      { render_id: 'preview_' + Date.now() + '_' + body.asset_id.slice(0, 8), primary_color: body.primary_color ?? '#084838' },
    );
    return NextResponse.json({ ok: true, thumbnails, source_asset_id: body.asset_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'thumbnail_gen_failed', detail: e?.message ?? null }, { status: 500 });
  }
}
