// app/cockpit/health/page.tsx
// Phase 3 monitoring dashboard. Vendor status + recent webhook events
// + open incidents + scheduled-task cost burn + cron job status.

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

const VENDORS = [
  { name: "Supabase", category: "infra", icon: "🗄️" },
  { name: "Vercel", category: "infra", icon: "▲" },
  { name: "GitHub", category: "devtool", icon: "🐙" },
  { name: "Cloudbeds", category: "pms", icon: "🛏️" },
  { name: "Anthropic API", category: "ai", icon: "🧠" },
];

async function loadVendorStatus(): Promise<Record<string, { last_event_at: string | null; last_event_action: string | null; healthy: boolean }>> {
  const { data } = await supabase
    .from("cockpit_audit_log")
    .select("agent, action, created_at, success")
    .in("agent", ["github-webhook", "supabase-webhook", "vercel-webhook", "deploy-prod-workflow", "cockpit-chat-upload"])
    .order("created_at", { ascending: false })
    .limit(200);

  const map: Record<string, { last_event_at: string | null; last_event_action: string | null; healthy: boolean }> = {};
  for (const v of VENDORS) map[v.name] = { last_event_at: null, last_event_action: null, healthy: true };
  for (const row of data ?? []) {
    const r = row as { agent: string; action: string; created_at: string; success: boolean };
    let vendor: string | null = null;
    if (r.agent === "github-webhook") vendor = "GitHub";
    else if (r.agent === "supabase-webhook") vendor = "Supabase";
    else if (r.agent === "vercel-webhook" || r.agent === "deploy-prod-workflow") vendor = "Vercel";
    if (vendor && !map[vendor].last_event_at) {
      map[vendor] = { last_event_at: r.created_at, last_event_action: r.action, healthy: r.success };
    }
  }
  return map;
}

async function loadRecentEvents() {
  const { data } = await supabase
    .from("cockpit_audit_log")
    .select("id, created_at, agent, action, target, success")
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

async function loadIncidents() {
  const { data } = await supabase
    .from("cockpit_incidents")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

async function loadCostBurn() {
  const { data } = await supabase.from("v_scheduled_task_cost_burn").select("*").limit(7);
  return (data ?? []) as Array<{ day: string; runs: number; spend_usd: number; failures: number }>;
}

async function loadCronJobs() {
  const { data } = await supabase
    .from("scheduled_task_runs")
    .select("task_name, cost_class, started_at, status, cost_usd")
    .order("started_at", { ascending: false })
    .limit(50);
  type Row = { task_name: string; cost_class: string; started_at: string; status: string; cost_usd: number };
  const rows = (data ?? []) as Row[];
  const latest = new Map<string, Row>();
  for (const r of rows) {
    if (!latest.has(r.task_name)) latest.set(r.task_name, r);
  }
  return Array.from(latest.values());
}

const EMPTY = "—";
function isoDate(s: string | null): string { return s ? s.slice(0, 10) : EMPTY; }
function isoFull(s: string | null): string { return s ? s.replace("T", " ").slice(0, 16) : EMPTY; }
function ageMin(s: string | null): string {
  if (!s) return EMPTY;
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
function tone(s: string): string {
  if (s === "succeeded" || s === "completed" || s === "active") return "var(--good, #2a7d2e)";
  if (s === "failed" || s === "open" || s === "high" || s === "critical") return "var(--bad, #b3261e)";
  if (s === "skipped" || s === "running") return "var(--warn, #b07a00)";
  return "var(--text-2)";
}

export default async function HealthPage() {
  noStore();
  const [vendors, events, incidents, costs, crons] = await Promise.all([
    loadVendorStatus(), loadRecentEvents(), loadIncidents(), loadCostBurn(), loadCronJobs(),
  ]);

  const todaySpend = costs[0]?.spend_usd ?? 0;
  const ceilingPct = (todaySpend / 20) * 100;

  return (
    <div style={{ padding: "2rem 3rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ fontSize: "var(--t-xs)", letterSpacing: "var(--ls-extra)", color: "var(--brass)", textTransform: "uppercase" }}>
        Cockpit · Monitoring
      </div>
      <h1 style={{ fontFamily: "var(--font-fraunces, Georgia), serif", fontStyle: "italic", fontSize: "var(--t-3xl)", margin: "0.25rem 0 0.5rem" }}>
        Health
      </h1>

      {/* Row 1: Vendor status tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 24 }}>
        {VENDORS.map((v) => {
          const s = vendors[v.name];
          const dot = s?.last_event_at && s.healthy ? "🟢" : !s?.last_event_at ? "⚪" : "🔴";
          return (
            <div key={v.name} style={{
              padding: "12px 16px", background: "var(--surface-1, #f6f3ee)", borderRadius: 8,
              border: "1px solid var(--border-2)",
            }}>
              <div style={{ fontSize: "var(--t-xs)", letterSpacing: "var(--ls-extra)", color: "var(--brass)", textTransform: "uppercase" }}>
                {v.icon} {v.name}
              </div>
              <div style={{ fontFamily: "var(--font-fraunces, Georgia), serif", fontStyle: "italic", fontSize: "var(--t-2xl)", margin: "4px 0" }}>
                {dot}
              </div>
              <div style={{ fontSize: "var(--t-xs)", color: "var(--text-3)" }}>{ageMin(s?.last_event_at ?? null)}</div>
            </div>
          );
        })}
      </div>

      {/* Row 2: Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginTop: 24 }}>
        <section>
          <h2 style={hStyle}>Recent events (50)</h2>
          <table style={tableStyle}>
            <thead><tr><th style={th}>Time</th><th style={th}>Agent</th><th style={th}>Action</th><th style={th}>Target</th></tr></thead>
            <tbody>
              {events.map((e) => {
                const r = e as { id: number; created_at: string; agent: string; action: string; target: string | null; success: boolean };
                return (
                  <tr key={r.id} style={trStyle}>
                    <td style={td}>{isoFull(r.created_at)}</td>
                    <td style={td}>{r.agent}</td>
                    <td style={{ ...td, color: r.success ? "inherit" : tone("failed") }}>{r.action}</td>
                    <td style={{ ...td, color: "var(--text-2)" }}>{r.target ?? EMPTY}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 style={hStyle}>Open incidents ({incidents.length})</h2>
          {incidents.length === 0 ? (
            <div style={{ color: "var(--text-3)", fontSize: "var(--t-sm)" }}>None.</div>
          ) : (
            <ul style={{ paddingLeft: 0, listStyle: "none" }}>
              {incidents.map((i) => {
                const r = i as { id: number; created_at: string; severity: string; summary: string };
                return (
                  <li key={r.id} style={{ borderBottom: "1px solid var(--border-2)", padding: "6px 0" }}>
                    <div style={{ fontSize: "var(--t-xs)", color: tone(r.severity), textTransform: "uppercase" }}>{r.severity}</div>
                    <div style={{ fontSize: "var(--t-sm)" }}>{r.summary}</div>
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--text-3)" }}>{ageMin(r.created_at)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 style={hStyle}>Cost burn</h2>
          <div style={{ padding: 12, background: "var(--surface-1, #f6f3ee)", borderRadius: 8 }}>
            <div style={{ fontSize: "var(--t-xs)", letterSpacing: "var(--ls-extra)", color: "var(--brass)", textTransform: "uppercase" }}>Today</div>
            <div style={{ fontFamily: "var(--font-fraunces, Georgia), serif", fontStyle: "italic", fontSize: "var(--t-2xl)" }}>
              ${todaySpend.toFixed(2)}
            </div>
            <div style={{
              height: 6, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden", marginTop: 8,
            }}>
              <div style={{
                width: `${Math.min(ceilingPct, 100)}%`,
                height: "100%",
                background: ceilingPct >= 75 ? tone("failed") : ceilingPct >= 50 ? tone("running") : tone("active"),
              }} />
            </div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--text-3)", marginTop: 4 }}>
              of $20/day ceiling · alarm at $15
            </div>
            <table style={{ ...tableStyle, marginTop: 12 }}>
              <thead><tr><th style={th}>Day</th><th style={thRight}>$</th><th style={thRight}>Runs</th></tr></thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.day} style={trStyle}>
                    <td style={td}>{isoDate(c.day)}</td>
                    <td style={tdRight}>${Number(c.spend_usd).toFixed(2)}</td>
                    <td style={tdRight}>{c.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Row 3: Scheduled tasks */}
      <section style={{ marginTop: 24 }}>
        <h2 style={hStyle}>Scheduled tasks ({crons.length})</h2>
        <table style={tableStyle}>
          <thead><tr><th style={th}>Task</th><th style={th}>Cost class</th><th style={th}>Last run</th><th style={th}>Status</th><th style={thRight}>Last cost</th></tr></thead>
          <tbody>
            {crons.map((c) => (
              <tr key={c.task_name} style={trStyle}>
                <td style={td}>{c.task_name}</td>
                <td style={td}>{c.cost_class === "green" ? "🟢" : c.cost_class === "yellow" ? "🟡" : c.cost_class === "red" ? "🔴" : "🟣"} {c.cost_class}</td>
                <td style={td}>{ageMin(c.started_at)}</td>
                <td style={{ ...td, color: tone(c.status) }}>{c.status}</td>
                <td style={tdRight}>${Number(c.cost_usd).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const hStyle: React.CSSProperties = {
  fontSize: "var(--t-xs)", letterSpacing: "var(--ls-extra)", color: "var(--brass)",
  textTransform: "uppercase", margin: "0 0 8px",
};
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" };
const th: React.CSSProperties = {
  textAlign: "left", padding: "6px 10px", fontSize: "var(--t-xs)", letterSpacing: "var(--ls-extra)",
  color: "var(--brass)", textTransform: "uppercase", borderBottom: "1px solid var(--border-1)",
};
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const trStyle: React.CSSProperties = { borderBottom: "1px solid var(--border-2)" };
const td: React.CSSProperties = { padding: "6px 10px" };
const tdRight: React.CSSProperties = { ...td, textAlign: "right" };
