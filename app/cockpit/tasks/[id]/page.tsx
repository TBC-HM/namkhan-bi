// app/cockpit/tasks/[id]/page.tsx
// Ticket detail — readable view of one ticket. Uses DashboardPage shell so
// navigation stays within the cockpit frame (fixes bug #33: pressing a task
// from the Beyond Circle IT sub-nav was escaping to the Namkhan top menu).

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { DashboardPage, Container } from "@/app/(cockpit)/_design";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Map ticket status values to the CSS custom property token for their badge bg.
// All hex values live in tokens.css — this file never touches raw hex.
const STATUS_TOKEN: Record<string, string> = {
  new:           "var(--status-ticket-new-bg)",
  triaging:      "var(--status-ticket-triaging-bg)",
  triaged:       "var(--status-ticket-triaged-bg)",
  working:       "var(--status-ticket-working-bg)",
  awaits_user:   "var(--status-ticket-awaits-user-bg)",
  completed:     "var(--status-ticket-completed-bg)",
  triage_failed: "var(--status-ticket-triage-failed-bg)",
  blocked:       "var(--status-ticket-blocked-bg)",
  archived:      "var(--status-ticket-archived-bg)",
};

function rel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function TicketPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return (
      <div style={{ background: "var(--color-white, #fff)", minHeight: "100vh" }}>
        <DashboardPage title="Cockpit · Tasks" subtitle="Ticket not found">
          <div style={{ gridColumn: "1 / -1", padding: 24, color: "var(--color-ink-soft, #5A5A5A)" }}>
            Invalid ticket id.
          </div>
        </DashboardPage>
      </div>
    );
  }

  const supabase = createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key")
  );

  const { data: t, error } = await supabase
    .from("cockpit_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !t) {
    return (
      <div style={{ background: "var(--color-white, #fff)", minHeight: "100vh" }}>
        <DashboardPage title={`Cockpit · Ticket #${id}`} subtitle="Not found">
          <div style={{ gridColumn: "1 / -1" }}>
            <Link href="/cockpit/tasks" style={{ color: "var(--color-brand-green, #084838)", fontSize: 13 }}>← All tasks</Link>
            <div style={{ marginTop: 16, color: "var(--color-ink-soft, #5A5A5A)", fontSize: 13 }}>Ticket not found.</div>
          </div>
        </DashboardPage>
      </div>
    );
  }

  const { data: audit } = await supabase
    .from("cockpit_audit_log")
    .select("created_at, agent, action, success, reasoning, metadata")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false })
    .limit(40);

  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const evidence = meta.evidence as Record<string, unknown> | undefined;
  const prUrl = (evidence?.pr_url as string) || (meta.pr_url as string) || null;
  const parentTicket = meta.parent_ticket as number | undefined;
  const children = (meta.sliced_into_children_v2 ?? meta.sliced_into_children) as number[] | undefined;

  const statusBg = STATUS_TOKEN[t.status] ?? "var(--status-ticket-archived-bg)";

  return (
    <div style={{ background: "var(--color-white, #fff)", minHeight: "100vh" }}>
      <DashboardPage
        title={`Cockpit · Ticket #${t.id}`}
        subtitle={`${t.source ?? "?"} · arm ${t.arm ?? "—"} · intent ${t.intent ?? "—"} · created ${rel(t.created_at)}`}
      >
        {/* Back navigation */}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16, alignItems: "center", marginBottom: 4 }}>
          <Link href="/cockpit/tasks" style={{ color: "var(--color-brand-green, #084838)", fontSize: 13, textDecoration: "none" }}>← All tasks</Link>
          {parentTicket && (
            <Link href={`/cockpit/tasks/${parentTicket}`} style={{ color: "var(--color-brand-green, #084838)", fontSize: 13, textDecoration: "none" }}>
              ↑ Parent #{parentTicket}
            </Link>
          )}
        </div>

        {/* Header: status badge + meta */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Container title={`Ticket #${t.id}`} subtitle={`updated ${rel(t.updated_at)}${t.iterations !== null ? ` · ${t.iterations} iter` : ""}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 12px",
                borderRadius: 4,
                background: statusBg,
                color: "var(--status-ticket-fg, #fff)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}>{t.status.toUpperCase()}</span>
              {prUrl && (
                <a href={prUrl} target="_blank" rel="noopener noreferrer"
                   style={{ padding: "6px 12px", background: "var(--color-brand-green, #084838)", color: "var(--color-white, #fff)", borderRadius: 6, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                  🔗 Open PR
                </a>
              )}
              <a href={`https://github.com/TBC-HM/namkhan-bi/issues?q=is%3Apr+${t.id}`} target="_blank" rel="noopener noreferrer"
                 style={{ padding: "6px 12px", border: "1px solid var(--color-hairline, #E6DFCC)", color: "var(--color-ink, #1B1B1B)", borderRadius: 6, fontSize: 13, textDecoration: "none" }}>
                🔍 Search GitHub
              </a>
            </div>
          </Container>
        </div>

        {/* Children */}
        {Array.isArray(children) && children.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Container title={`Children (${children.length})`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {children.map(c => (
                  <Link key={c} href={`/cockpit/tasks/${c}`}
                        style={{ padding: "4px 10px", border: "1px solid var(--color-hairline, #E6DFCC)", color: "var(--color-brand-green, #084838)", borderRadius: 4, fontSize: 12, textDecoration: "none", background: "var(--surface-hover, #F4F4EE)" }}>
                    #{c}
                  </Link>
                ))}
              </div>
            </Container>
          </div>
        )}

        {/* Summary */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Container title="Summary">
            <pre style={{
              background: "var(--surface-hover, #F4F4EE)",
              border: "1px solid var(--color-hairline, #E6DFCC)",
              padding: 16,
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--color-ink, #1B1B1B)",
              whiteSpace: "pre-wrap",
              overflow: "auto",
              maxHeight: 500,
              fontFamily: "system-ui, -apple-system, sans-serif",
              margin: 0,
            }}>{t.parsed_summary ?? "(empty)"}</pre>
          </Container>
        </div>

        {/* Metadata */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Container title="Metadata">
            <pre style={{
              background: "var(--surface-hover, #F4F4EE)",
              border: "1px solid var(--color-hairline, #E6DFCC)",
              padding: 16,
              borderRadius: 6,
              fontSize: 11,
              color: "var(--color-ink-soft, #5A5A5A)",
              overflow: "auto",
              maxHeight: 300,
              margin: 0,
            }}>{JSON.stringify(meta, null, 2)}</pre>
          </Container>
        </div>

        {/* Audit log */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Container title={`Audit log (${audit?.length ?? 0})`}>
            {!audit || audit.length === 0 ? (
              <div style={{ color: "var(--color-ink-soft, #5A5A5A)", fontSize: 12 }}>No audit entries yet.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {audit.map((a, i) => {
                  const am = (a.metadata ?? {}) as Record<string, unknown>;
                  const url = (am.html_url as string) ?? (am.pr_url as string) ?? null;
                  return (
                    <li key={i} style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--color-hairline, #E6DFCC)",
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                    }}>
                      <div style={{ width: 70, fontSize: 11, color: "var(--color-ink-soft, #5A5A5A)" }}>{rel(a.created_at)}</div>
                      <div style={{
                        width: 100,
                        fontSize: 12,
                        color: a.success ? "var(--audit-success-color)" : "var(--audit-failure-color)",
                        fontWeight: 600,
                      }}>{a.agent}</div>
                      <div style={{ width: 130, fontSize: 12, color: "var(--color-ink-soft, #5A5A5A)" }}>{a.action}</div>
                      <div style={{ flex: 1, fontSize: 12, color: "var(--color-ink, #1B1B1B)" }}>
                        {(a.reasoning ?? "").slice(0, 200)}
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                             style={{ marginLeft: 6, color: "var(--color-brand-green, #084838)" }}>→</a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}
