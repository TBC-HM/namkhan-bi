// app/cockpit/tasks/page.tsx
// Transparent task viewer — shows EVERY ticket regardless of status.
// PBS directive 2026-05-08: "many tasks disappeared, no archive, system needs redesign".
// This page is the truth: filter by status, see what's actually happening.

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ticket = {
  id: number;
  status: string;
  arm: string | null;
  intent: string | null;
  source: string | null;
  parsed_summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  new: "#888",
  triaging: "#888",
  triaged: "#2c6cf6",
  working: "#e8a13a",
  awaits_user: "#a04ad0",
  completed: "#1c5b22",
  triage_failed: "#d04444",
  blocked: "#d04444",
  archived: "#999",
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function TasksPage({ searchParams }: { searchParams?: { status?: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const filter = searchParams?.status ?? "all";
  let query = supabase
    .from("cockpit_tickets")
    .select("id, status, arm, intent, source, parsed_summary, metadata, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(150);
  if (filter !== "all") query = query.eq("status", filter);

  const { data, error } = await query;
  const tickets = (data ?? []) as Ticket[];

  // Status counts (always show all)
  const { data: counts } = await supabase
    .from("cockpit_tickets")
    .select("status");
  const countByStatus: Record<string, number> = {};
  for (const r of counts ?? []) {
    const s = (r as { status: string }).status;
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;
  }

  return (
    <main style={{ background: "#0a0a0b", color: "white", minHeight: "100vh", padding: "24px 32px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 4 }}>All tasks</h1>
        <div style={{ fontSize: 12, color: "#888" }}>
          The truth about every ticket — nothing hidden.
        </div>
      </header>

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <a
          href="/cockpit/tasks"
          style={{
            padding: "6px 12px",
            border: filter === "all" ? "1.5px solid #fff" : "1px solid #444",
            background: filter === "all" ? "#222" : "transparent",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          All <span style={{ opacity: 0.6 }}>· {Object.values(countByStatus).reduce((a, b) => a + b, 0)}</span>
        </a>
        {Object.entries(countByStatus)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => (
            <a
              key={s}
              href={`/cockpit/tasks?status=${s}`}
              style={{
                padding: "6px 12px",
                border: filter === s ? `1.5px solid ${STATUS_COLOR[s] ?? "#fff"}` : "1px solid #444",
                background: filter === s ? STATUS_COLOR[s] : "transparent",
                color: filter === s ? "#0a0a0b" : (STATUS_COLOR[s] ?? "white"),
                borderRadius: 6,
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {s} <span style={{ opacity: 0.7 }}>· {n}</span>
            </a>
          ))}
      </div>

      {error ? (
        <div style={{ padding: 16, background: "#400", borderRadius: 6 }}>
          Error: {error.message}
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ padding: 24, color: "#888", textAlign: "center" }}>No tickets matching filter.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", color: "#888", textAlign: "left" }}>
              <th style={{ padding: "8px 12px", width: 60 }}>ID</th>
              <th style={{ padding: "8px 12px", width: 110 }}>Status</th>
              <th style={{ padding: "8px 12px", width: 80 }}>Arm</th>
              <th style={{ padding: "8px 12px", width: 80 }}>Intent</th>
              <th style={{ padding: "8px 12px" }}>Summary</th>
              <th style={{ padding: "8px 12px", width: 80 }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const meta = (t.metadata ?? {}) as Record<string, unknown>;
              const lastSpec = meta.last_specialist as string | undefined;
              const evidence = meta.evidence as Record<string, unknown> | undefined;
              const prUrl = (evidence?.pr_url as string) || (meta.pr_url as string) || null;
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #1f1f1f" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#888" }}>#{t.id}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: STATUS_COLOR[t.status] ?? "#444",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {t.status}
                    </span>
                    {lastSpec && <span style={{ marginLeft: 6, fontSize: 10, color: "#888" }}>· {lastSpec}</span>}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#aaa", fontSize: 12 }}>{t.arm ?? "—"}</td>
                  <td style={{ padding: "8px 12px", color: "#aaa", fontSize: 12 }}>{t.intent ?? "—"}</td>
                  <td style={{ padding: "8px 12px", color: "white", maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(t.parsed_summary ?? "").replace(/\n/g, " · ").slice(0, 140)}
                    {prUrl && (
                      <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: "#5fa", fontSize: 11 }}>
                        → PR
                      </a>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#888", fontSize: 11 }}>{relTime(t.updated_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <footer style={{ marginTop: 32, fontSize: 11, color: "#666", textAlign: "center" }}>
        Showing {tickets.length} of {Object.values(countByStatus).reduce((a, b) => a + b, 0)} tickets · Refresh manually (Cmd+R) for latest
      </footer>
    </main>
  );
}
