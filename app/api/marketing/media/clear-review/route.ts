// app/api/marketing/media/clear-review/route.ts
// POST { asset_id } — clear the Iris review flag (needs_review=false, review_reason=NULL).
// PBS 2026-07-14 · TASK 3.
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 2 — switch to canonical
//   public.fn_clear_review (ADR-149..152).
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

  const { data, error } = await sb.rpc('fn_clear_review', { p_asset_id: id });
  if (error) return NextResponse.json({ error: 'clear_failed', detail: error.message, code: error.code }, { status: 500 });
  const res = (data as { ok?: boolean; asset_id?: string; error?: string } | null) ?? null;
  if (!res || !res.ok) return NextResponse.json({ error: res?.error ?? 'clear_failed_or_not_found' }, { status: 400 });
  return NextResponse.json(res);
}