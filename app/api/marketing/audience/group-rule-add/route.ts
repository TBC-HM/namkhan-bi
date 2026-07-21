// app/api/marketing/audience/group-rule-add/route.ts
// POST — add a rule to a subscriber group.
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
  const group_id = typeof body?.group_id === 'string' ? body.group_id : '';
  const field    = typeof body?.field === 'string' ? body.field : '';
  const operator = typeof body?.operator === 'string' ? body.operator : '';
  const value    = body?.value == null ? null : String(body.value);

  if (!group_id || !field || !operator) {
    return NextResponse.json({ ok: false, error: 'group_id, field, operator required' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('fn_group_rule_add', {
    p_group_id: group_id,
    p_field: field,
    p_operator: operator,
    p_value: value,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'add_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
