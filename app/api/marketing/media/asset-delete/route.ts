// app/api/marketing/media/asset-delete/route.ts
// POST { asset_id } — soft-delete an asset (status='removed'). PBS 2026-07-12.
// v_marketing_media_page already filters out status IN ('removed','archived','qc_failed')
// so the tile disappears on next refresh. Undo via fn_media_asset_undelete RPC.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: { asset_id?: string; actor?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const id = body?.asset_id;
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'asset_id must be UUID' }, { status: 400 });
  }
  const { data, error } = await sb.rpc('fn_media_asset_soft_delete', { p_asset_id: id, p_actor: body?.actor ?? 'PBS' });
  if (error) return NextResponse.json({ error: 'delete_failed', detail: error.message, code: error.code }, { status: 500 });
  const res = data as { ok?: boolean; error?: string };
  if (!res?.ok) return NextResponse.json({ error: res?.error ?? 'delete_failed' }, { status: 400 });
  return NextResponse.json(res);
}
