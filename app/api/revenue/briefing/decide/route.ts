// app/api/revenue/briefing/decide/route.ts
// PBS 2026-07-15 — POST endpoint that records a Briefing decision and, if
// the decision is "accept" AND the item's cta_target is "rpc:<fn_name>",
// also fires that RPC with cta_params. Read + write both go through the
// SECURITY DEFINER path (fn_briefing_decide + the CTA RPC itself); we never
// touch briefing.items directly from PostgREST (schema not exposed).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Req {
  id: number;
  decision: 'accept' | 'dismiss' | 'snooze';
  reason?: string | null;
  snooze_hours?: number | null;
}

const VALID_DECISIONS = new Set(['accept', 'dismiss', 'snooze']);

export async function POST(req: Request) {
  let body: Req;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!Number.isFinite(body.id) || !VALID_DECISIONS.has(body.decision)) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // 1. Record the decision
  const { data: ok, error: decideErr } = await sb.rpc('fn_briefing_decide', {
    p_id: body.id,
    p_decision: body.decision,
    p_reason: body.reason ?? null,
    p_snooze_hours: body.snooze_hours ?? 24,
  });

  if (decideErr) {
    return NextResponse.json({ ok: false, error: decideErr.message }, { status: 502 });
  }
  if (ok !== true) {
    return NextResponse.json({ ok: false, error: 'briefing_id_not_found' }, { status: 404 });
  }

  // 2. If accept, fire the CTA (only when cta_target is "rpc:<fn>")
  let ctaResult: unknown = null;
  let ctaError: string | null = null;

  if (body.decision === 'accept') {
    const { data: rows, error: readErr } = await sb
      .from('v_revenue_briefings')
      .select('cta_target, cta_params, cta_kind')
      .eq('id', body.id)
      .maybeSingle();

    if (readErr) {
      // Non-fatal: decision was recorded; CTA firing is best-effort.
      ctaError = `cta_lookup_failed: ${readErr.message}`;
    } else if (rows?.cta_target && typeof rows.cta_target === 'string' && rows.cta_target.startsWith('rpc:')) {
      const fnName = rows.cta_target.slice(4).trim();
      if (/^[a-z_][a-z0-9_]*$/i.test(fnName)) {
        const params = (rows.cta_params ?? {}) as Record<string, unknown>;
        const { data: r, error: rpcErr } = await sb.rpc(fnName, params);
        if (rpcErr) ctaError = `rpc_failed: ${rpcErr.message}`;
        else ctaResult = r;
      } else {
        ctaError = `rpc_name_invalid: ${fnName}`;
      }
    }
  }

  return NextResponse.json({ ok: true, cta_result: ctaResult, cta_error: ctaError });
}
