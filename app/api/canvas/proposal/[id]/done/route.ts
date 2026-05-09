// Mark a proposal done. For now the executor is mocked — once real
// integrations land (Cloudbeds rate write, email send, OTA promo pause),
// the run handler hooks here with evidence.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const evidence = body.evidence ?? null;

  const { data, error } = await supabase
    .from('cockpit_proposals')
    .update({ status: 'done', finished_at: new Date().toISOString(), evidence })
    .eq('id', id)
    .in('status', ['in_process', 'proposal'])
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not found' }, { status: 404 });

  await supabase.from('cockpit_audit_log').insert({
    agent: 'canvas',
    action: 'proposal_done',
    target: `proposal:${id}`,
    success: true,
    metadata: { proposal_id: id, action_type: data.action_type, agent_role: data.agent_role, evidence },
    reasoning: `Completed: ${data.signal}`,
  });

  return NextResponse.json({ proposal: data });
}
