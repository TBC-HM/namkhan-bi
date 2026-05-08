// Reject a proposal → status='rejected'; trigger bumps reject_count and
// re-locks auto-run for the (agent, action_type) pair.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 400) : null;

  const { data, error } = await supabase
    .from('cockpit_proposals')
    .update({ status: 'rejected', rejected_reason: reason })
    .eq('id', id)
    .eq('status', 'proposal')
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not found' }, { status: 404 });

  await supabase.from('cockpit_audit_log').insert({
    agent: 'pbs',
    action: 'proposal_rejected',
    target: `proposal:${id}`,
    success: true,
    metadata: { proposal_id: id, action_type: data.action_type, agent_role: data.agent_role, reason },
    reasoning: reason || 'no reason given',
  });

  return NextResponse.json({ proposal: data });
}
