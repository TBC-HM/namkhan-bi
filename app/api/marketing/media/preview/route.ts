// app/api/marketing/media/preview/route.ts
// PBS 2026-07-14 v4 — CRITICAL FIX: proxy image bytes instead of 302 redirect.
// Root cause: NextResponse.redirect(signedUrl, 302) got cached by browsers +
// Vercel edge. Once the 1h JWT expired, cached redirects kept sending users to
// dead URLs → 400 InvalidJWT → every Library tile blank. Rewriting to stream
// the image bytes back means:
//   • the signed URL is fetched server-side, fresh every request (Cache-Control:no-store on the redirect)
//   • the response body is the actual image (Content-Type: image/*), safely cacheable for 60s
//   • no client ever sees a signed URL — so it can't be cached with a stale token
// v3 kept: Storage TRANSFORM (width=800, contain, quality=80) — fixes HEIC + huge phone photos.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get('asset_id') ?? '';
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  const width = Math.min(Math.max(Number(req.nextUrl.searchParams.get('w') ?? 800), 200), 1568);
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

  const { data: signed, error: signErr } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, 3600, {
      transform: { width, height: width, resize: 'contain', quality: 80 },
    });

  if (signErr || !signed?.signedUrl) {
    if (debug) return NextResponse.json({ stage: 'sign', bucket, path, error: signErr?.message ?? 'sign_failed' }, { status: 500 });
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message ?? null }, { status: 500 });
  }

  if (debug) {
    return NextResponse.json({
      ok: true, bucket, path, width, signedUrl: signed.signedUrl,
      mime_type: row.mime_type, asset_type: row.asset_type,
    });
  }

  // Proxy the image bytes — never expose the signed URL to the client so it
  // can't be cached with a token that later expires (v3 regression).
  const upstream = await fetch(signed.signedUrl, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'upstream_failed', status: upstream.status }, { status: 502 });
  }
  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Bytes are cacheable for 60s by browsers + Vercel edge, since they don't
      // contain the signed URL. When the token would expire, we simply re-sign.
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
