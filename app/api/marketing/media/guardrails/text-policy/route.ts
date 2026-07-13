// app/api/marketing/media/guardrails/text-policy/route.ts
// PBS 2026-07-14 · Task B — Detected-text policy (singleton) read + upsert.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_media_text_policy').select('*').eq('id', 1).maybeSingle();
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok:true, data: data ?? null });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? 'unknown' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok:false, error: 'invalid_json' }, { status: 400 }); }
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('fn_media_text_policy_upsert', { p: body });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message ?? 'unknown' }, { status: 500 });
  }
}
