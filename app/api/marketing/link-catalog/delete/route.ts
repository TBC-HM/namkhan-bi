// app/api/marketing/link-catalog/delete/route.ts
// POST — delete an internal_link_catalog row (blocks pinned rows).
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  const { data, error } = await sb.rpc('fn_internal_link_catalog_delete', { p_id: id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'delete_failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
