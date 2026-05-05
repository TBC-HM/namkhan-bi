// POST /api/proc/decide
// Wraps proc.proc_pr_decide RPC. Approver role hard-coded to 'owner' under the
// current password-gated dashboard (single user = owner). Replace with real
// role lookup once auth has per-user roles.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DecideInput {
  pr_id: string;
  decision: 'approve' | 'send_back' | 'reject';
  notes?: string | null;
  actor_role?: string;          // optional override; defaults to 'owner'
}

export async function POST(req: Request) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  let body: DecideInput;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.pr_id || !body.decision) {
    return NextResponse.json({ error: 'pr_id + decision required' }, { status: 400 });
  }
  if (!['approve', 'send_back', 'reject'].includes(body.decision)) {
    return NextResponse.json({ error: 'decision must be approve / send_back / reject' }, { status: 400 });
  }

  const actorRole = body.actor_role ?? 'owner';

  const { data, error } = await admin
    .schema('proc')
    .rpc('proc_pr_decide', {
      p_pr_id: body.pr_id,
      p_actor_id: null,
      p_actor_role: actorRole,
      p_decision: body.decision,
      p_notes: body.notes ?? null,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: data });
}
