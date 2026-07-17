// app/api/marketing/media/preview-any/route.ts
// PBS 2026-07-17 hot-fix — Review tab tiles surface ingested-status assets
// (raw upload, not fully processed) which /api/marketing/media/preview skips
// because that route reads v_marketing_media_page (ready-only filter).
// This sibling reads media.media_assets directly via service-role so ANY
// asset renders as long as raw_path or master_path exists. Additive; the
// existing /preview route stays unchanged.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get('asset_id') ?? '';
  if (!assetId || !UUID_RE.test(assetId)) {
    return NextResponse.json({ error: 'asset_id_required' }, { status: 400 });
  }

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e?.message ?? 'admin_init_failed' }, { status: 500 }); }

  const { data: row, error } = await sb
    .schema('media' as any)
    .from('media_assets')
    .select('raw_path, master_path, mime_type, asset_type, is_ai_generated')
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'lookup_failed', detail: error.message }, { status: 500 });
  if (!row)  return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!row.raw_path && !row.master_path) return NextResponse.json({ error: 'no_path' }, { status: 404 });

  let bucket: string;
  let path: string;
  if (row.master_path) {
    bucket = row.is_ai_generated ? 'media-ai' : 'media-renders';
    path = row.master_path;
  } else if (row.raw_path!.startsWith('branding/')) {
    bucket = 'branding';
    path = row.raw_path!.replace(/^branding\//, '');
  } else {
    bucket = 'media-raw';
    path = row.raw_path!;
  }

  const { data: blob, error: dlErr } = await sb.storage.from(bucket).download(path);
  if (dlErr || !blob) {
    return NextResponse.json({ error: 'download_failed', detail: dlErr?.message ?? null, bucket, path }, { status: 500 });
  }

  const arrayBuf = await blob.arrayBuffer();
  const contentType = blob.type || row.mime_type || 'image/jpeg';

  return new Response(arrayBuf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    },
  });
}