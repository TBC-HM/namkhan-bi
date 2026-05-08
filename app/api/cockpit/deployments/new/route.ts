// app/api/cockpit/deployments/new/route.ts
// PBS hits "+ New" in the ND dropdown, types what he wants, sends.
// → creates a triaged ticket addressed to code_writer with autonomy mandate.
// Agent picks up next cron tick, ships PR, auto-merges if green.
//
// 2026-05-07 PBS directive: "third button = new"

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });

  // Minimal heuristic — if PBS mentions a /route, infer arm/intent.
  const routeMatch = text.match(/\/[a-z0-9_/-]+/);
  const route = routeMatch ? routeMatch[0] : null;

  const { data: row, error } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: "pbs-nd-new",
      arm: "dev",
      intent: "build",
      status: "triaged",
      parsed_summary: `**PBS new task**\n\n${text}${route ? `\n\nLikely route: ${route}` : ""}\n\nApply autonomy mandate. Ship a PR. PBS reviews via the ND dropdown.`,
      notes: JSON.stringify({
        arm: "dev",
        intent: "build",
        urgency: "medium",
        summary: text.slice(0, 200),
        plan: [
          "read repo to find target file (search_repo if uncertain)",
          "compose change",
          "github_commit_file to feature/agent-{id}-{slug}",
          "github_open_pr base=main label=agent-shipped (auto-merge enabled)",
        ],
        recommended_role: "code_writer",
        recommended_agent: "code_writer",
        blockers: [],
        estimated_minutes: 20,
      }),
      metadata: {
        pbs_freeform: true,
        next_specialist: "code_writer",
        target_route: route,
        autonomy_rule_applied: "autonomy_default_mandate_v1",
      },
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert failed" }, { status: 500 });
  }

  await supabase.from("cockpit_audit_log").insert({
    agent: "pbs",
    action: "new_ticket_freeform",
    target: `ticket:${row.id}`,
    success: true,
    metadata: { text: text.slice(0, 500), route, ticket_id: row.id },
    reasoning: text.slice(0, 200),
  });

  return NextResponse.json({ ok: true, ticket_id: row.id });
}
