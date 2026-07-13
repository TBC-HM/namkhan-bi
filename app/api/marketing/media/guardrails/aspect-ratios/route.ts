// app/api/marketing/media/guardrails/aspect-ratios/route.ts
// PBS 2026-07-14 · Task B — Aspect ratio rules read + upsert.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_media_aspect_ratio_rules').select('*').order('channel', { ascending: true });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok:true, data: data ?? [] });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? 'unknown' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok:false, error: 'invalid_json' }, { status: 400 }); }
  const channel = String(body?.channel ?? '').trim();
  if (!channel) return NextResponse.json({ ok:false, error: 'channel required' }, { status: 400 });
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_media_aspect_ratio_rule_upsert', { p_channel: channel, p: body });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok:true, data: { channel: data } });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? 'unknown' }, { status: 500 });
  }
}
