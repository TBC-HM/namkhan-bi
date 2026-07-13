// app/api/marketing/media/asset-play-url/route.ts
// POST — mint a short-lived signed URL for playback of a raw video asset.
// Body: { asset_id }
// Returns: { url, expires_in_seconds }
// PBS 2026-07-13 · Coordinator scope-add for VideoPlayerModal.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL = 3600; // 1 hour

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

  // Look up raw_path (master_path preferred if available, else raw_path).
  // Route through v_marketing_media_page (public) — has master_path + raw_path.
  const { data: rows, error: qErr } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, raw_path, master_path')
    .eq('asset_id', asset_id)
    .limit(1);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 502 });
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: 'asset not found' }, { status: 404 });

  const path = row.master_path ?? row.raw_path;
  if (!path) return NextResponse.json({ error: 'no_storage_path' }, { status: 404 });

  const bucket = row.master_path ? 'media-masters' : 'media-raw';
  const { data: signed, error: signErr } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, TTL);
  if (signErr || !signed) {
    // Fallback: try the other bucket
    const altBucket = bucket === 'media-raw' ? 'media-masters' : 'media-raw';
    const altPath = bucket === 'media-raw' ? row.master_path : row.raw_path;
    if (altPath) {
      const { data: alt } = await sb.storage.from(altBucket).createSignedUrl(altPath, TTL);
      if (alt?.signedUrl) return NextResponse.json({ url: alt.signedUrl, expires_in_seconds: TTL });
    }
    return NextResponse.json({ error: 'sign_failed', detail: signErr?.message }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expires_in_seconds: TTL });
}
