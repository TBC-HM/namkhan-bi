// app/api/cockpit/skills/request_skill_approval/route.ts
// COWORK BRIEF v2 / GAP 10 — open a sub-ticket asking PBS to approve a gated write skill.
//
// Body: { target_skill, action_summary, reasoning, rollback_plan?, parent_ticket_id? }
// Creates cockpit_tickets row with status='pending_pbs_approval', returns ticket_id.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key"
);

function isAuthorized(req: Request): boolean {
  if (process.env.COCKPIT_AUTH_GATE !== "on") return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && auth.slice(7) === process.env.COCKPIT_AGENT_TOKEN;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: {
    target_skill?: string;
    action_summary?: string;
    reasoning?: string;
    rollback_plan?: string;
    parent_ticket_id?: number;
    requesting_agent?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const target_skill = body.target_skill?.trim();
  const action_summary = body.action_summary?.trim();
  const reasoning = body.reasoning?.trim();
  if (!target_skill || !action_summary || !reasoning) {
    return NextResponse.json({ ok: false, error: "target_skill, action_summary, reasoning all required" }, { status: 400 });
  }

  const subject = `[skill_approval] ${target_skill} — ${action_summary.slice(0, 80)}`;
  const noteJson = JSON.stringify({
    type: "skill_approval_request",
    target_skill,
    action_summary,
    reasoning,
    rollback_plan: body.rollback_plan ?? null,
    requesting_agent: body.requesting_agent ?? null,
    parent_ticket_id: body.parent_ticket_id ?? null,
    requested_at: new Date().toISOString(),
  }, null, 2);

  const { data, error } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: "skill_approval_request",
      arm: "dev",
      intent: "skill_approval",
      status: "pending_pbs_approval",
      email_subject: subject,
      parsed_summary: action_summary,
      notes: noteJson,
      metadata: {
        tags: ["skill_approval"],
        target_skill,
        parent_ticket_id: body.parent_ticket_id ?? null,
      },
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: body.requesting_agent ?? "skill-approval",
    action: "request_skill_approval",
    target: target_skill,
    success: true,
    ticket_id: data.id,
    metadata: {
      target_skill,
      parent_ticket_id: body.parent_ticket_id ?? null,
    },
    reasoning: `Opened approval sub-ticket #${data.id} for ${target_skill}.`,
  });

  return NextResponse.json({
    ok: true,
    ticket_id: data.id,
    status: "pending_pbs_approval",
    next_step: "PBS reviews ticket and flips status to triaged (approve) or completed with rejection note (reject).",
  });
}
