// app/api/marketing/media/rule-upsert/route.ts
// POST — upsert media.media_usage_rules via public.fn_media_rule_upsert (SECURITY DEFINER).
// Body: { rule_id?, rule_code, rule_name, rule_scope, effect, match_tier?, match_channel?, message, remediation?, priority?, active? }
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

  const required = ['rule_code','rule_name','rule_scope','effect','message'] as const;
  if (!body.rule_id) {
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ error: `missing_${k}` }, { status: 400 });
      }
    }
  }

  // Normalise: strip empty strings/nulls that would clobber existing fields on update.
  const payload: Record<string, any> = { ...body };
  if (payload.rule_id != null) payload.rule_id = String(payload.rule_id);
  if (payload.priority != null) payload.priority = Number(payload.priority);
  if (payload.active != null)   payload.active   = Boolean(payload.active);

  try {
    const { data, error } = await sb.rpc('fn_media_rule_upsert', { p: payload });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rule_id: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'unknown' }, { status: 500 });
  }
}
