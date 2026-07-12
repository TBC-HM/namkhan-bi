// POST /api/marketing/upload-finalize
// Confirms a signed-URL upload completed successfully via SECURITY DEFINER RPC
// public.fn_media_asset_upload_finalize (dedup-safe, optional campaign_tag).
//
// 2026-07-12 pm: rewired off `sb.schema('media' as any)` (PostgREST doesn't
// expose the media schema) — now goes through the public RPC. See memory
// feedback_postgrest_schema_writes_repeat_burn.
//
// Body: { asset_id, campaign_tag? }
// Returns: { ok, asset_id, status }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: { asset_id?: string; campaign_tag?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { asset_id, campaign_tag } = body;
  if (!asset_id) return NextResponse.json({ error: 'missing_asset_id' }, { status: 400 });

  const { data: rows, error: rpcErr } = await admin.rpc('fn_media_asset_upload_finalize', {
    p_asset_id: asset_id,
    p_campaign_tag: campaign_tag ?? null,
  });
  if (rpcErr) {
    return NextResponse.json({
      error: 'db_finalize_failed',
      detail: rpcErr.message,
      code: rpcErr.code,
      hint: rpcErr.hint,
    }, { status: 500 });
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.ok) return NextResponse.json({ error: 'asset_not_found_or_no_raw_path' }, { status: 404 });
  return NextResponse.json({ ok: true, asset_id: row.asset_id, status: row.status });
}
