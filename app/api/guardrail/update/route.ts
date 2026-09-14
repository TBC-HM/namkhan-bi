// app/api/guardrail/update/route.ts
// PBS 2026-07-06 late evening: update a guardrail threshold value + notes.
// 2026-09-14: L22 fix — was hardcoding PROPERTY_ID; now requires property_id in body
//   and verifies caller access via requirePropertyAccess() (ADR-281).
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  property_id: number;
  domain: string;
  rule_key: string;
  threshold_val: number;
  active?: boolean;
  notes?: string;
}

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  if (!body.property_id || !body.domain || !body.rule_key || !Number.isFinite(body.threshold_val)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  let propertyId: number;
  try {
    propertyId = await requirePropertyAccess(req, body.property_id);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok: false, error: 'authorization_check_failed' }, { status: 403 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_guardrail_update', {
    p_property_id: propertyId,
    p_domain: body.domain,
    p_rule_key: body.rule_key,
    p_threshold: body.threshold_val,
    p_active: body.active ?? true,
    p_notes: body.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: data });
}
