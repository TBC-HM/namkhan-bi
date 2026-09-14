// app/api/marketing/briefing/decide/route.ts
// PBS 2026-09-14 — marketing-domain briefing decision endpoint.
// Auth: verifies the caller's session can see the briefing's property before
// allowing any write (IDOR guard). fn_briefing_decide + v_marketing_briefings
// are SECURITY DEFINER — service-role only, no RLS — so tenancy enforcement
// lives here, not in the DB function.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionScope, canSeeProperty } from '@/lib/session-scope';

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
  // 0. Authenticate the session first — must happen before any admin client use.
  const scope = await getSessionScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

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

  // 1. Look up the briefing row to get its property_id — then verify access (IDOR guard).
  const { data: brief, error: briefErr } = await sb
    .from('v_marketing_briefings')
    .select('property_id, cta_target, cta_params, cta_kind')
    .eq('id', body.id)
    .maybeSingle();

  if (briefErr) {
    return NextResponse.json({ ok: false, error: briefErr.message }, { status: 502 });
  }
  if (!brief) {
    return NextResponse.json({ ok: false, error: 'briefing_id_not_found' }, { status: 404 });
  }
  if (!canSeeProperty(brief.property_id, scope)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // 2. Record the decision via the SECURITY DEFINER RPC.
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
    return NextResponse.json({ ok: false, error: 'decide_failed' }, { status: 502 });
  }

  // 3. If accept, fire the CTA — best-effort, data already loaded in step 1.
  let ctaResult: unknown = null;
  let ctaError: string | null = null;

  if (body.decision === 'accept' && brief.cta_target && typeof brief.cta_target === 'string' && brief.cta_target.startsWith('rpc:')) {
    const fnName = brief.cta_target.slice(4).trim();
    if (/^[a-z_][a-z0-9_]*$/i.test(fnName)) {
      const params = (brief.cta_params ?? {}) as Record<string, unknown>;
      const { data: r, error: rpcErr } = await sb.rpc(fnName, params);
      if (rpcErr) ctaError = `rpc_failed: ${rpcErr.message}`;
      else ctaResult = r;
    } else {
      ctaError = `rpc_name_invalid: ${fnName}`;
    }
  }

  return NextResponse.json({ ok: true, cta_result: ctaResult, cta_error: ctaError });
}
