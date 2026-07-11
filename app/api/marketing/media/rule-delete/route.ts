// app/api/marketing/media/rule-delete/route.ts
// POST — delete a media.media_usage_rules row via public.fn_media_rule_delete (SECURITY DEFINER).
// Body: { rule_id: number }
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const rule_id = Number(body?.rule_id);
  if (!rule_id || !Number.isFinite(rule_id)) return NextResponse.json({ error: 'missing_rule_id' }, { status: 400 });

  try {
    const { data, error } = await sb.rpc('fn_media_rule_delete', { p_rule_id: rule_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
