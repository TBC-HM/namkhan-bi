// app/api/cockpit/briefs/status/route.ts
// Bug #89 — wires the missing status-transition endpoint for build briefs.
// Called by BriefActions (client component) on every Confirm/Start/Ship/Archive click.
// Calls fn_set_build_brief_status RPC (public bridge over documentation schema).
// Logs every transition to cockpit_audit_log (best-effort — failure does NOT block the action).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  let body: { slug?: string; status?: string; actor?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { slug, status, actor = 'PBS' } = body;

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }
  if (!status || typeof status !== 'string') {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const ALLOWED_STATUSES = ['draft', 'ready', 'in_progress', 'verifying', 'needs_input', 'shipped', 'archived'];
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status "${status}". Allowed: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // ── Primary action: set brief status via public RPC bridge ──────────────
  const { error: rpcErr } = await (sb as any).rpc('fn_set_build_brief_status', {
    p_slug: slug,
    p_status: status,
    p_actor: actor,
  });

  if (rpcErr) {
    // Surface real DB error so PBS sees it in BriefActions and knows the click failed.
    return NextResponse.json(
      { error: rpcErr.message ?? 'fn_set_build_brief_status failed' },
      { status: 500 },
    );
  }

  // ── Audit log: best-effort insert (never blocks the response) ──────────
  try {
    await (sb as any).from('cockpit_audit_log').insert({
      actor,
      action: 'brief_status_transition',
      target_type: 'build_brief',
      target_slug: slug,
      payload: { status },
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal — log to console only so backend can diagnose if the table
    // doesn't exist yet, but the status change already succeeded.
    console.warn('[cockpit/briefs/status] audit_log insert failed (non-fatal)');
  }

  return NextResponse.json({ slug, status });
}
