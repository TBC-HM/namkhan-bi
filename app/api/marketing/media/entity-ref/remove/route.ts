// app/api/marketing/media/entity-ref/remove/route.ts
// POST — detach a reference-photo link by row id. PBS 2026-07-12.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  let body: { id?: number | string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await sb.rpc('fn_entity_reference_asset_remove', { p_id: id });
  if (error) return NextResponse.json({ error: 'remove_failed', detail: error.message, code: error.code, hint: error.hint }, { status: 500 });
  return NextResponse.json({ ok: true, removed: Boolean(data) });
}
