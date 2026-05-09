// app/cockpit/tasks/page.tsx
// Transparent task viewer — shows EVERY ticket regardless of status.
// PBS directive 2026-05-08: "many tasks disappeared, no archive, system needs redesign".
// PBS 2026-05-09 #24: "when I press task it must expand bigger that I can read the
// whole task and it must say on top how much more time until due".
//   → rows are now <details> cards; click expands full summary + email body + metadata.
//   → SLA: 48h default from created_at unless metadata.due_at is set.

import { createClient } from "@supabase/supabase-js";
import Page from "@/components/page/Page";
import { TicketRowActions, BulkClear } from "./_components/TicketActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ticket = {
  id: number;
  status: string;
  arm: string | null;
  intent: string | null;
  source: string | null;
  email_subject: string | null;
  email_body: string | null;
  parsed_summary: string | null;
  pr_url: string | null;
  preview_url: string | null;
  github_issue_url: string | null;
  iterations: number | null;
  closed_at: string | null;
  notes: string | null;
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

const SLA_HOURS = 48;
const TERMINAL = new Set(["completed", "archived", "triage_failed"]);

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtHrs(hours: number): string {
  if (Math.abs(hours) < 1) return `${Math.round(hours * 60)}m`;
  if (Math.abs(hours) < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function dueState(t: Ticket): { label: string; tone: "good" | "warn" | "bad" | "muted" } {
  if (TERMINAL.has(t.status)) {
    return { label: t.closed_at ? `closed ${relTime(t.closed_at)} ago` : `closed`, tone: "muted" };
  }
  const meta = t.metadata ?? {};
  const dueIso = (meta.due_at as string | undefined)
    ?? new Date(new Date(t.created_at).getTime() + SLA_HOURS * 3600 * 1000).toISOString();
  const remainingMs = new Date(dueIso).getTime() - Date.now();
  const remainingHrs = remainingMs / 3600 / 1000;
  if (remainingHrs >= 0) {
    return {
      label: `due in ${fmtHrs(remainingHrs)}`,
      tone: remainingHrs < 6 ? "warn" : "good",
    };
  }
  return { label: `overdue ${fmtHrs(-remainingHrs)}`, tone: "bad" };
}

const TONE_BG: Record<string, string> = {
  good:  "rgba(28, 91, 34, 0.18)",
  warn:  "rgba(232, 161, 58, 0.20)",
  bad:   "rgba(208, 68, 68, 0.22)",
  muted: "rgba(120,120,120,0.12)",
};
const TONE_FG: Record<string, string> = {
  good:  "#7ad790",
  warn:  "#f4c179",
  bad:   "#ff8a8a",
  muted: "#999",
};

export default async function TasksPage({ searchParams }: { searchParams?: { status?: string } }) {
  const supabase = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key")
  );

  const filter = searchParams?.status ?? "all";
  let query = supabase
    .from("cockpit_tickets")
    .select("id, status, arm, intent, source, email_subject, email_body, parsed_summary, pr_url, preview_url, github_issue_url, iterations, closed_at, notes, metadata, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(150);
  if (filter !== "all") query = query.eq("status", filter);

  const { data, error } = await query;
  const tickets = (data ?? []) as Ticket[];

  const { data: counts } = await supabase
    .from("cockpit_tickets")
    .select("status");
  const countByStatus: Record<string, number> = {};
  for (const r of counts ?? []) {
    const s = (r as { status: string }).status;
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;
  }

  return (
    <Page eyebrow="Cockpit · Tasks" title={<>All <em style={{ color: "var(--brass)", fontStyle: "italic" }}>tasks</em></>}>
      <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
        Every ticket — nothing hidden. SLA {SLA_HOURS}h from creation unless <code>metadata.due_at</code> overrides.
      </div>

      {/* Status filter chips + bulk-clear actions (PBS 2026-05-09) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
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
        <BulkClear
          archivedCount={countByStatus['archived'] ?? 0}
          completedCount={countByStatus['completed'] ?? 0}
        />
      </div>

      {error ? (
        <div style={{ padding: 16, background: "#400", borderRadius: 6, color: "#fdd" }}>
          Error: {error.message}
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ padding: 24, color: "#888", textAlign: "center" }}>No tickets matching filter.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tickets.map((t) => {
            const meta = (t.metadata ?? {}) as Record<string, unknown>;
            const lastSpec = meta.last_specialist as string | undefined;
            const evidence = meta.evidence as Record<string, unknown> | undefined;
            const prUrl = t.pr_url || (evidence?.pr_url as string) || (meta.pr_url as string) || null;
            const previewUrl = t.preview_url || (evidence?.preview_url as string) || null;
            const due = dueState(t);
            const summary = (t.parsed_summary ?? t.email_subject ?? "(no summary)").trim();
            return (
              <details
                key={t.id}
                style={{
                  background: "#11110f",
                  border: "1px solid #232118",
                  borderRadius: 6,
                  padding: "10px 14px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 13,
                  }}
                >
                  <span style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: "#888",
                    fontSize: 11,
                    minWidth: 48,
                  }}>#{t.id}</span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: STATUS_COLOR[t.status] ?? "#444",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 600,
                    minWidth: 80,
                    textAlign: "center",
                  }}>{t.status}</span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: TONE_BG[due.tone],
                    color: TONE_FG[due.tone],
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    minWidth: 110,
                    textAlign: "center",
                  }}>{due.label}</span>
                  <span style={{
                    color: "#e9e1ce",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>{summary.replace(/\n/g, " · ").slice(0, 200)}</span>
                  <span style={{ color: "#777", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {relTime(t.updated_at)} ago
                  </span>
                  <TicketRowActions id={t.id} status={t.status} />
                </summary>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #232118", display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
                    <span><strong style={{ color: "#aaa" }}>Created:</strong> {new Date(t.created_at).toLocaleString()}</span>
                    <span><strong style={{ color: "#aaa" }}>Updated:</strong> {new Date(t.updated_at).toLocaleString()}</span>
                    {t.closed_at && <span><strong style={{ color: "#aaa" }}>Closed:</strong> {new Date(t.closed_at).toLocaleString()}</span>}
                    <span><strong style={{ color: "#aaa" }}>Arm:</strong> {t.arm ?? "—"}</span>
                    <span><strong style={{ color: "#aaa" }}>Intent:</strong> {t.intent ?? "—"}</span>
                    <span><strong style={{ color: "#aaa" }}>Source:</strong> {t.source ?? "—"}</span>
                    <span><strong style={{ color: "#aaa" }}>Iterations:</strong> {t.iterations ?? 0}</span>
                    {lastSpec && <span><strong style={{ color: "#aaa" }}>Last specialist:</strong> {lastSpec}</span>}
                  </div>

                  {t.parsed_summary && (
                    <div>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Summary</div>
                      <div style={{ color: "#e9e1ce", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{t.parsed_summary}</div>
                    </div>
                  )}

                  {(t.email_subject || t.email_body) && (
                    <div>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Original email</div>
                      {t.email_subject && (
                        <div style={{ color: "#d8cca8", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.email_subject}</div>
                      )}
                      {t.email_body && (
                        <div style={{ color: "#bbb", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto", padding: 8, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4 }}>
                          {t.email_body}
                        </div>
                      )}
                    </div>
                  )}

                  {t.notes && (
                    <div>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Notes</div>
                      <div style={{ color: "#bbb", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{t.notes}</div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                    {prUrl && <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#5fa" }}>→ PR ↗</a>}
                    {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#5fa" }}>→ Preview ↗</a>}
                    {t.github_issue_url && <a href={t.github_issue_url} target="_blank" rel="noopener noreferrer" style={{ color: "#5fa" }}>→ GitHub issue ↗</a>}
                    <a href={`/cockpit/tasks/${t.id}`} style={{ color: "#d9bf8e" }}>→ Full ticket page</a>
                  </div>

                  {meta && Object.keys(meta).length > 0 && (
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.12em" }}>Metadata JSON</summary>
                      <pre style={{ marginTop: 6, padding: 8, background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 4, color: "#bbb", fontSize: 11, lineHeight: 1.5, overflowX: "auto" }}>
                        {JSON.stringify(meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <footer style={{ marginTop: 32, fontSize: 11, color: "#666", textAlign: "center" }}>
        Showing {tickets.length} of {Object.values(countByStatus).reduce((a, b) => a + b, 0)} tickets · Refresh manually (Cmd+R) for latest
      </footer>
    </Page>
  );
}
