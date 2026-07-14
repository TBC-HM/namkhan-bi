// app/api/marketing/media/preview/route.ts
// PBS 2026-07-14 v5 — sb.storage.from(...).download() instead of createSignedUrl
// (v4 regressed: Supabase transform-sign endpoint returns a memoised URL with
//  frozen iat/exp — every fresh call returned an 18h-old expired token → 400).
//   Trade-off: skip on-the-fly resize; return original bytes. For 30MB phone
//   originals we pay the bandwidth once, then Vercel edge caches for 60s. The
//   Library tile only shows a small crop so browser scales client-side.
// v3 comment kept for history: TRANSFORM signed URL was meant to normalise HEIC
//   + huge phones. HEIC still won't render in browsers without conversion — but
//   at least standard JPEG/PNG/WebP now works, which is ~99% of the library.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get('asset_id') ?? '';
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  if (!assetId) return NextResponse.json({ error: 'asset_id_required' }, { status: 400 });

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) {
    if (debug) return NextResponse.json({ stage: 'admin_init', error: e?.message ?? 'admin_init_failed' }, { status: 500 });
    return NextResponse.json({ error: 'admin_init_failed' }, { status: 500 });
  }

  const { data: row, error } = await sb
    .from('v_marketing_media_page')
    .select('raw_path,master_path,mime_type,asset_type,is_ai_generated')
    .eq('asset_id', assetId)
    .maybeSingle();

  if (error) {
    if (debug) return NextResponse.json({ stage: 'lookup', error: error.message }, { status: 500 });
    return NextResponse.json({ error: 'lookup_failed', detail: error.message }, { status: 500 });
  }
  if (!row) {
    if (debug) return NextResponse.json({ stage: 'lookup', error: 'not_found', asset_id: assetId }, { status: 404 });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!row.raw_path && !row.master_path) {
    if (debug) return NextResponse.json({ stage: 'resolve', error: 'no_raw_or_master_path' }, { status: 404 });
    return NextResponse.json({ error: 'no_raw_path' }, { status: 404 });
  }

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
    if (debug) return NextResponse.json({ stage: 'download', bucket, path, error: dlErr?.message ?? 'no_blob' }, { status: 500 });
    return NextResponse.json({ error: 'download_failed', detail: dlErr?.message ?? null }, { status: 500 });
  }

  if (debug) {
    return NextResponse.json({
      ok: true, bucket, path,
      mime_type: row.mime_type, asset_type: row.asset_type,
      size_bytes: blob.size,
    });
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
