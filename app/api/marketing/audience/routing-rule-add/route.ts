// app/api/marketing/audience/routing-rule-add/route.ts
// POST — add an import routing rule.
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const body = await req.json().catch(() => ({}));
  const property_id = body?.property_id == null ? null : Number(body.property_id);
  const rule_type = typeof body?.rule_type === 'string' ? body.rule_type : '';
  const pattern = typeof body?.pattern === 'string' ? body.pattern.trim() : '';
  const target_value = body?.target_value == null ? null : String(body.target_value);

  if (!pattern) return NextResponse.json({ ok: false, error: 'pattern required' }, { status: 400 });
  if (!['include_folder','exclude_label','auto_tag','auto_group'].includes(rule_type)) {
    return NextResponse.json({ ok: false, error: 'invalid rule_type' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_routing_rule_add', {
    p_property_id: property_id,
    p_rule_type: rule_type,
    p_pattern: pattern,
    p_target_value: target_value,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'add_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
