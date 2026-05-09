// app/api/cockpit/skills/ticket_assign_dry_run/route.ts
// ZIP 5 Phase 5 — dry-run ticket re-assignment. dry_run=false actually updates.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");

function authed(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  return (req.headers.get("authorization") ?? "") === `Bearer ${process.env.COCKPIT_AGENT_TOKEN}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { ticket_id, new_role, dry_run = true } = body as { ticket_id?: number; new_role?: string; dry_run?: boolean };
  if (!ticket_id || !new_role) return NextResponse.json({ ok: false, error: "ticket_id + new_role required" }, { status: 400 });

  const { data: ticket } = await supabase.from("cockpit_tickets").select("id, arm, intent, parsed_summary, metadata").eq("id", ticket_id).single();
  if (!ticket) return NextResponse.json({ ok: false, error: "ticket not found" }, { status: 404 });

  const proposed = {
    ticket_id, current_arm: ticket.arm, new_role,
    new_metadata: { ...(ticket.metadata ?? {}), recommended_role: new_role, reassigned_at: new Date().toISOString() },
  };

  if (dry_run) {
    await supabase.from("cockpit_audit_log").insert({
      agent: "skill-ticket-assign", action: "dry_run_assign_propose", target: `cockpit_tickets:${ticket_id}`, success: true,
      metadata: { dry_run: true, proposed }, reasoning: `Dry-run: ticket #${ticket_id} (${ticket.arm}) → ${new_role}.`,
    });
    return NextResponse.json({ ok: true, dry_run: true, proposed });
  }

  const { error } = await supabase.from("cockpit_tickets").update({ metadata: proposed.new_metadata }).eq("id", ticket_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await supabase.from("cockpit_audit_log").insert({
    agent: "skill-ticket-assign", action: "ticket_reassigned", target: `cockpit_tickets:${ticket_id}`, success: true, ticket_id,
    metadata: { new_role }, reasoning: `Ticket #${ticket_id} reassigned to ${new_role}.`,
  });
  return NextResponse.json({ ok: true, ticket_id, new_role, dry_run: false });
}
