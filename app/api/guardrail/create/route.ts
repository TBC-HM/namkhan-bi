// app/api/guardrail/create/route.ts
// PBS 2026-07-06 v2: create (or upsert) a guardrail rule from the Settings > Guardrails cockpit.
// Delegates to public.fn_guardrail_create(bigint, text, text, text, numeric, text).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  domain: string;
  rule_key: string;
  threshold_kind: string;
  threshold_val: number;
  notes?: string;
}

export async function POST(req: Request) {
  let body: Req;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (
    !body.domain ||
    !body.rule_key ||
    !body.threshold_kind ||
    !Number.isFinite(body.threshold_val)
  ) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  if (!['gte', 'lte', 'eq'].includes(body.threshold_kind)) {
    return NextResponse.json({ ok: false, error: 'threshold_kind_must_be_gte_lte_eq' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_guardrail_create', {
    p_property_id: PROPERTY_ID,
    p_domain: body.domain,
    p_rule_key: body.rule_key,
    p_threshold_kind: body.threshold_kind,
    p_threshold_val: body.threshold_val,
    p_notes: body.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: data });
}
