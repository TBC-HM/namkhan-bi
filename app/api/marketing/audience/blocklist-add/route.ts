// app/api/marketing/audience/blocklist-add/route.ts
// POST — add a blocklist rule (returns preview matched_count, does NOT delete).
// GET?list=1 — return current blocklist rows for client refresh.
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get('list') !== '1') {
    return NextResponse.json({ ok: false, error: 'use ?list=1' }, { status: 400 });
  }
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
  const { data, error } = await sb.from('v_marketing_subscriber_blocklist').select('*').limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const property_id = body?.property_id == null ? null : Number(body.property_id);
  const pattern = typeof body?.pattern === 'string' ? body.pattern.trim() : '';
  const pattern_type = typeof body?.pattern_type === 'string' ? body.pattern_type : '';
  const reason = typeof body?.reason === 'string' ? body.reason : null;

  if (!pattern) return NextResponse.json({ ok: false, error: 'pattern required' }, { status: 400 });
  if (!['email','domain','prefix'].includes(pattern_type)) {
    return NextResponse.json({ ok: false, error: 'invalid pattern_type' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_blocklist_add', {
    p_property_id: property_id,
    p_pattern: pattern,
    p_pattern_type: pattern_type,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'add_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id, matched_count: res.matched_count });
}
