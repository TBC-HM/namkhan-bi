// Returns the 3 lanes (proposal / in_process / done) + recent rejects.
// Used by the canvas UI to render the kanban below the brief.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

export async function GET() {
  noStore();
  const { data: rows } = await supabase
    .from('cockpit_proposals')
    .select('id, agent_role, action_type, dept, signal, body, status, requires_approval, created_at, started_at, finished_at, evidence')
    .order('created_at', { ascending: false })
    .limit(60);

  const lanes = {
    proposal:   (rows ?? []).filter((r) => r.status === 'proposal'),
    in_process: (rows ?? []).filter((r) => r.status === 'in_process'),
    done:       (rows ?? []).filter((r) => r.status === 'done').slice(0, 12),
    rejected:   (rows ?? []).filter((r) => r.status === 'rejected').slice(0, 6),
  };

  // Trust meter — list of (agent, action) with their counters
  const { data: trust } = await supabase
    .from('agent_trust')
    .select('agent_role, action_type, approve_count, reject_count, threshold, auto_unlocked');

  return NextResponse.json({ lanes, trust: trust ?? [] });
}
