// app/api/cockpit/standing-task/run/route.ts
// Activate a standing task by slug. Creates a real cockpit_ticket from the
// task template and lets the agent worker pick it up.
//
// POST /api/cockpit/standing-task/run?slug=site_design_sweep

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  noStore();
  const { data, error } = await supabase
    .from("cockpit_standing_tasks")
    .select("id, slug, name, description, last_run_at, run_count, active")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: Request) {
  noStore();
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const { data: task, error: tErr } = await supabase
    .from("cockpit_standing_tasks")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .single();
  if (tErr || !task) return NextResponse.json({ error: "task not found or inactive" }, { status: 404 });

  const tpl = task.ticket_template as { arm?: string; intent?: string; parsed_summary?: string };

  const { data: ticket, error: insErr } = await supabase
    .from("cockpit_tickets")
    .insert({
      source: `standing_task:${slug}`,
      arm: tpl.arm ?? "ops",
      intent: tpl.intent ?? "investigate",
      status: "new",
      parsed_summary: tpl.parsed_summary ?? task.description,
      iterations: 0,
    })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Bump run counter.
  await supabase
    .from("cockpit_standing_tasks")
    .update({ last_run_at: new Date().toISOString(), run_count: (task.run_count ?? 0) + 1 })
    .eq("id", task.id);

  await supabase.from("cockpit_audit_log").insert({
    agent: "standing_task_runner",
    action: "run",
    target: `task:${slug}`,
    success: true,
    metadata: { task_slug: slug, ticket_id: ticket.id },
    reasoning: `activated standing task "${task.name}"`,
    ticket_id: ticket.id,
  });

  return NextResponse.json({ task: { slug, name: task.name }, ticket_id: ticket.id, status: "queued" });
}
