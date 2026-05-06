// app/api/cockpit/activity/route.ts
// Live activity feed for the Activity tab.
// Returns: pipeline funnel (counts by status), live working boxes, recent
// timeline (last 50 events), cost-by-day for last 7d, runs-by-day.

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
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since1h = new Date(Date.now() - 3600_000).toISOString();

  const [ticketsRes, auditRes, workingRes, identityRes] = await Promise.all([
    supabase
      .from("cockpit_tickets")
      .select("id, status, arm, created_at, source")
      .gte("created_at", since7d),
    supabase
      .from("cockpit_audit_log")
      .select("id, ticket_id, agent, action, success, created_at, cost_usd_milli, duration_ms, reasoning")
      .gte("created_at", since1h)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("cockpit_tickets")
      .select("id, status, arm, parsed_summary, updated_at")
      .in("status", ["triaging", "working"])
      .order("updated_at", { ascending: false }),
    supabase
      .from("cockpit_agent_identity")
      .select("role, display_name, avatar, color"),
  ]);

  const tickets = (ticketsRes.data ?? []) as { id: number; status: string; arm: string; created_at: string; source: string }[];
  const events = (auditRes.data ?? []) as Array<{ id: number; ticket_id: number | null; agent: string; action: string; success: boolean; created_at: string; cost_usd_milli: number | null; duration_ms: number | null; reasoning: string | null }>;
  const working = (workingRes.data ?? []) as Array<{ id: number; status: string; arm: string; parsed_summary: string | null; updated_at: string }>;
  const identities = (identityRes.data ?? []) as Array<{ role: string; display_name: string; avatar: string; color: string | null }>;

  const identityByRole: Record<string, { display_name: string; avatar: string; color: string | null }> = {};
  for (const i of identities) identityByRole[i.role] = i;

  // Pipeline funnel.
  const funnel = {
    new: 0,
    triaging: 0,
    triaged: 0,
    working: 0,
    awaits_user: 0,
    completed: 0,
    failed: 0,
  };
  for (const t of tickets) {
    if (t.status === "new" || t.status === "triaging") funnel[t.status as keyof typeof funnel] += 1;
    else if (t.status === "triaged") funnel.triaged += 1;
    else if (t.status === "working") funnel.working += 1;
    else if (t.status === "awaits_user") funnel.awaits_user += 1;
    else if (t.status === "completed") funnel.completed += 1;
    else if (t.status === "blocked" || t.status === "triage_failed") funnel.failed += 1;
  }

  // 7-day buckets.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const ticketsByDay = days.map((day) => ({ day, count: tickets.filter((t) => t.created_at.slice(0, 10) === day).length }));

  // Cost by day from extended audit query (separate, since 7d is broader).
  const { data: costRows } = await supabase
    .from("cockpit_audit_log")
    .select("agent, cost_usd_milli, created_at")
    .gte("created_at", since7d)
    .not("cost_usd_milli", "is", null);
  const costByDay = days.map((day) => {
    const milli = (costRows ?? []).filter((r) => r.created_at.slice(0, 10) === day).reduce((s, r) => s + (r.cost_usd_milli ?? 0), 0);
    return { day, cost_usd: milli / 1000 };
  });

  // Live working boxes — annotate with identity.
  const live = working.map((w) => ({
    ticket_id: w.id,
    status: w.status,
    agent_role: w.status === "triaging" ? "it_manager" : w.arm,
    display_name: identityByRole[w.status === "triaging" ? "it_manager" : w.arm]?.display_name ?? w.arm,
    avatar: identityByRole[w.status === "triaging" ? "it_manager" : w.arm]?.avatar ?? "🤖",
    color: identityByRole[w.status === "triaging" ? "it_manager" : w.arm]?.color ?? null,
    summary: (w.parsed_summary ?? "").split("\n")[0].slice(0, 120),
    elapsed_ms: Date.now() - new Date(w.updated_at).getTime(),
  }));

  // Recent timeline.
  const timeline = events.map((e) => ({
    id: e.id,
    ticket_id: e.ticket_id,
    agent: e.agent,
    display_name: identityByRole[e.agent]?.display_name ?? e.agent,
    avatar: identityByRole[e.agent]?.avatar ?? "🤖",
    color: identityByRole[e.agent]?.color ?? null,
    action: e.action,
    success: e.success,
    created_at: e.created_at,
    cost_usd: e.cost_usd_milli ? (e.cost_usd_milli / 1000).toFixed(4) : null,
    duration_ms: e.duration_ms,
    reasoning: (e.reasoning ?? "").slice(0, 160),
  }));

  return NextResponse.json({
    funnel,
    live_working: live,
    timeline,
    days_buckets: { tickets_by_day: ticketsByDay, cost_by_day: costByDay },
    summary: {
      tickets_7d: tickets.length,
      events_1h: events.length,
      working_now: working.length,
    },
  });
}
