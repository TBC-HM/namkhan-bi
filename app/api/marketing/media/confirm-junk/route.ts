// app/api/marketing/media/confirm-junk/route.ts
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 2 — Junk cull for
// Review tab. POST { asset_id } → public.fn_confirm_junk (SECURITY DEFINER,
// reversible soft-delete, respects tier_locked). Kept SEPARATE from the older
// /asset-delete route so Library's generic Delete button (which routes any
// asset regardless of review state) stays on fn_media_asset_soft_delete.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: { asset_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const id = body?.asset_id;
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'asset_id must be UUID' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_confirm_junk', { p_asset_id: id });
  if (error) return NextResponse.json({ error: 'junk_failed', detail: error.message, code: error.code }, { status: 500 });
  const res = (data as { ok?: boolean; error?: string } | null) ?? null;
  if (!res || !res.ok) return NextResponse.json({ error: res?.error ?? 'not_found_or_locked' }, { status: 400 });
  return NextResponse.json(res);
}