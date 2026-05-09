// Approve a proposal → status flips to in_process; the trigger bumps trust.
// "Run" is logged in audit; real execution (Cloudbeds write etc.) wires
// next via cockpit_tickets dispatch.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const { data, error } = await supabase
    .from('cockpit_proposals')
    .update({ status: 'in_process', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'proposal')
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not found or already advanced' }, { status: 404 });

  await supabase.from('cockpit_audit_log').insert({
    agent: 'pbs',
    action: 'proposal_approved',
    target: `proposal:${id}`,
    success: true,
    metadata: { proposal_id: id, action_type: data.action_type, agent_role: data.agent_role },
    reasoning: `Approved: ${data.signal}`,
  });

  return NextResponse.json({ proposal: data });
}
