// app/api/marketing/media/apply-iris-filename/route.ts
// POST { asset_id } OR { asset_ids:[…] } — write seo_target_filename INTO
// original_filename via SECURITY DEFINER RPCs. No storage move.
// PBS 2026-07-14 · Media QA v2 · Task 3.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: { asset_id?: string; asset_ids?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (Array.isArray(body.asset_ids) && body.asset_ids.length > 0) {
    const ids = body.asset_ids.filter((s) => typeof s === 'string' && UUID_RE.test(s));
    if (ids.length === 0) return NextResponse.json({ error: 'no_valid_asset_ids' }, { status: 400 });
    if (ids.length > 2000) return NextResponse.json({ error: 'batch_too_large_max_2000' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_media_asset_apply_iris_filename_batch', { p_asset_ids: ids });
    if (error) return NextResponse.json({ error: 'rpc_failed', detail: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, result: data });
  }

  const asset_id = body.asset_id;
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }
  const { data, error } = await sb.rpc('fn_media_asset_apply_iris_filename', { p_asset_id: asset_id });
  if (error) return NextResponse.json({ error: 'rpc_failed', detail: error.message }, { status: 502 });
  return NextResponse.json(data ?? { ok: false });
}
