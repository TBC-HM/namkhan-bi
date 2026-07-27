// app/api/holding/it/cockpit/memory/route.ts
// Platform Memory module server ops (brief module-doc-architecture-memory-v1).
//
//   POST { op: 'doc_version', hist_id }        -> full snapshot via public.fn_get_doc_version
//   POST { op: 'search', q }                   -> public.fn_brain_platform_search
//   POST { op: 'merge_apply', proposal_id }    -> public.fn_rule_merge_apply   (holding-only)
//   POST { op: 'merge_reject', proposal_id }   -> public.fn_rule_merge_reject  (holding-only)
//
// WRITE-PATH LAW: browser never touches tables — canon writes go through the
// SECURITY DEFINER RPCs shipped with this module. Merge ops require
// role_level='holding' (same guard as the versioned prompt write route) and
// every accepted merge decision is mirrored to public.cockpit_audit_log.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionScope } from '@/lib/session-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  op?: 'doc_version' | 'search' | 'merge_apply' | 'merge_reject';
  hist_id?: number;
  q?: string;
  proposal_id?: number;
};

async function logAudit(action: string, target: string, success: boolean, actor: string | null, metadata: Record<string, unknown>): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await admin.from('cockpit_audit_log').insert({
      agent: actor ?? 'anonymous',
      action,
      target,
      success,
      metadata,
      reasoning: 'Platform Memory rule-consolidation op (module-doc-architecture-memory-v1)',
    });
  } catch {
    // audit is best-effort; never block the op on it
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  if (body.op === 'doc_version') {
    if (!body.hist_id) return NextResponse.json({ error: 'hist_id required' }, { status: 400 });
    const { data, error } = await admin.rpc('fn_get_doc_version', { p_hist_id: body.hist_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, snapshot: data });
  }

  if (body.op === 'search') {
    const q = (body.q ?? '').trim();
    if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });
    const { data, error } = await admin.rpc('fn_brain_platform_search', { p_q: q, p_limit: 12 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, results: data ?? [] });
  }

  if (body.op === 'merge_apply' || body.op === 'merge_reject') {
    if (!body.proposal_id) return NextResponse.json({ error: 'proposal_id required' }, { status: 400 });
    const scope = await getSessionScope();
    const isHolding = scope.isHolding && !!scope.email;
    if (!isHolding) {
      await logAudit('rule_merge_blocked', `proposal:${body.proposal_id}`, false, scope.email, {
        op: body.op, role_level: scope.roleLevel,
      });
      return NextResponse.json({ error: "forbidden: rule consolidation requires holding role_level" }, { status: 403 });
    }
    const fn = body.op === 'merge_apply' ? 'fn_rule_merge_apply' : 'fn_rule_merge_reject';
    const { data, error } = await admin.rpc(fn, { p_proposal_id: body.proposal_id });
    if (error) {
      await logAudit(body.op, `proposal:${body.proposal_id}`, false, scope.email, { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const result = data as { ok?: boolean; error?: string } | null;
    await logAudit(body.op, `proposal:${body.proposal_id}`, !!result?.ok, scope.email, { result });
    if (!result?.ok) return NextResponse.json({ error: result?.error ?? 'merge op failed' }, { status: 409 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'unknown op' }, { status: 400 });
}
