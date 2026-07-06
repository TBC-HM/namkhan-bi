// app/api/guardrail/dismiss/route.ts
// PBS 2026-07-06 evening: records why an operator dismissed a conclusion.
// Used to fine-tune guardrail thresholds and build the
// "Proposals followed vs dismissed" gold container.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PBS 2026-07-07: 'other' reason accepted with an optional free-text note.
interface Req { insight_key: string; reason: string; note?: string | null; }

const VALID_REASONS = new Set(['handled', 'not_relevant', 'threshold', 'false_signal', 'other']);

export async function POST(req: Request) {
  let body: Req;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  if (!body.insight_key || !VALID_REASONS.has(body.reason)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_guardrail_log_dismiss', {
    p_insight_key: body.insight_key,
    p_reason: body.reason,
    p_note: body.note ?? null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
