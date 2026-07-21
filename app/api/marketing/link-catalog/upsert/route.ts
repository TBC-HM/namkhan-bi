// app/api/marketing/link-catalog/upsert/route.ts
// POST — upsert an internal_link_catalog row via fn_internal_link_catalog_upsert RPC.
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

  if (!body?.url && !body?.id) {
    return NextResponse.json({ ok: false, error: 'url or id required' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_internal_link_catalog_upsert', { p_payload: body });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, result: data });
}

export async function GET(_req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
  const { data, error } = await sb.schema('marketing').from('internal_link_catalog').select('*').order('is_pinned', { ascending: false }).order('id', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
