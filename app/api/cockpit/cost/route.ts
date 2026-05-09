// app/api/cockpit/cost/route.ts
// Aggregates spend across cockpit_audit_log: 24h / 7d / 30d, top tickets, top agents.

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type AuditRow = {
  ticket_id: number | null;
  agent: string;
  action: string;
  cost_usd_milli: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  created_at: string;
};

export async function GET() {
  noStore();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("cockpit_audit_log")
    .select("ticket_id, agent, action, cost_usd_milli, input_tokens, output_tokens, duration_ms, created_at")
    .gte("created_at", since30d)
    .not("cost_usd_milli", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AuditRow[];
  const now = Date.now();
  const within = (ms: number) => rows.filter((r) => now - new Date(r.created_at).getTime() < ms);

  const sumMilli = (rs: AuditRow[]) => rs.reduce((s, r) => s + (r.cost_usd_milli ?? 0), 0);
  const sumTokIn = (rs: AuditRow[]) => rs.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const sumTokOut = (rs: AuditRow[]) => rs.reduce((s, r) => s + (r.output_tokens ?? 0), 0);

  const r24 = within(86400_000);
  const r7d = within(7 * 86400_000);
  const r30d = rows;

  // Top tickets by cumulative cost (24h window — most actionable).
  const byTicket24h = new Map<number, { cost_milli: number; runs: number; agents: Set<string> }>();
  for (const r of r24) {
    if (!r.ticket_id) continue;
    if (!byTicket24h.has(r.ticket_id)) byTicket24h.set(r.ticket_id, { cost_milli: 0, runs: 0, agents: new Set() });
    const t = byTicket24h.get(r.ticket_id)!;
    t.cost_milli += r.cost_usd_milli ?? 0;
    t.runs += 1;
    t.agents.add(r.agent);
  }
  const topTickets24h = Array.from(byTicket24h.entries())
    .map(([id, t]) => ({ ticket_id: id, cost_usd: (t.cost_milli / 1000).toFixed(4), runs: t.runs, agents: Array.from(t.agents) }))
    .sort((a, b) => Number(b.cost_usd) - Number(a.cost_usd))
    .slice(0, 10);

  // Top agents by cumulative cost (7d window).
  const byAgent7d = new Map<string, { cost_milli: number; runs: number; tok_in: number; tok_out: number; total_ms: number }>();
  for (const r of r7d) {
    if (!byAgent7d.has(r.agent)) byAgent7d.set(r.agent, { cost_milli: 0, runs: 0, tok_in: 0, tok_out: 0, total_ms: 0 });
    const a = byAgent7d.get(r.agent)!;
    a.cost_milli += r.cost_usd_milli ?? 0;
    a.runs += 1;
    a.tok_in += r.input_tokens ?? 0;
    a.tok_out += r.output_tokens ?? 0;
    a.total_ms += r.duration_ms ?? 0;
  }
  const topAgents7d = Array.from(byAgent7d.entries())
    .map(([agent, a]) => ({
      agent,
      cost_usd: (a.cost_milli / 1000).toFixed(4),
      runs: a.runs,
      avg_cost_usd: (a.cost_milli / 1000 / a.runs).toFixed(4),
      avg_duration_ms: a.runs > 0 ? Math.round(a.total_ms / a.runs) : 0,
      tokens_in: a.tok_in,
      tokens_out: a.tok_out,
    }))
    .sort((a, b) => Number(b.cost_usd) - Number(a.cost_usd));

  return NextResponse.json({
    totals: {
      "24h": { cost_usd: (sumMilli(r24) / 1000).toFixed(4), runs: r24.length, tokens_in: sumTokIn(r24), tokens_out: sumTokOut(r24) },
      "7d": { cost_usd: (sumMilli(r7d) / 1000).toFixed(4), runs: r7d.length, tokens_in: sumTokIn(r7d), tokens_out: sumTokOut(r7d) },
      "30d": { cost_usd: (sumMilli(r30d) / 1000).toFixed(4), runs: r30d.length, tokens_in: sumTokIn(r30d), tokens_out: sumTokOut(r30d) },
    },
    top_tickets_24h: topTickets24h,
    top_agents_7d: topAgents7d,
  });
}
