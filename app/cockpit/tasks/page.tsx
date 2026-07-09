// app/cockpit/tasks/page.tsx
// Transparent task viewer — shows EVERY ticket regardless of status.
// PBS 2026-05-08: "many tasks disappeared, no archive, system needs redesign".
// PBS 2026-05-09 #24: "when I press task it must expand bigger that I can read the
// whole task and it must say on top how much more time until due".
// PBS 2026-07-09: adapted to paper-white DashboardPage + status KPI strip;
// removed from /holding top strip (still reachable via DeptEntry landing).

import { createClient } from "@supabase/supabase-js";
import { DashboardPage, Container, KpiTile, type KpiTileProps } from "@/app/(cockpit)/_design";
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
  new:           "#5A5A5A",
  triaging:      "#5A5A5A",
  triaged:       "#2C6CF6",
  working:       "#B47A1F",
  awaits_user:   "#8047A0",
  completed:     "#1F5C2C",
  triage_failed: "#B04A2F",
  blocked:       "#B04A2F",
  archived:      "#9AA0A6",
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
    return { label: `due in ${fmtHrs(remainingHrs)}`, tone: remainingHrs < 6 ? "warn" : "good" };
  }
  return { label: `overdue ${fmtHrs(-remainingHrs)}`, tone: "bad" };
}

const TONE_BG: Record<string, string> = {
  good:  "#E7F1E9",
  warn:  "#FBF1DE",
  bad:   "#F5EDEB",
  muted: "#F4F4EE",
};
const TONE_FG: Record<string, string> = {
  good:  "#1F5C2C",
  warn:  "#8B5A1C",
  bad:   "#B04A2F",
  muted: "#5A5A5A",
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

  const { data: counts } = await supabase.from("cockpit_tickets").select("status");
  const countByStatus: Record<string, number> = {};
  for (const r of counts ?? []) {
    const s = (r as { status: string }).status;
    countByStatus[s] = (countByStatus[s] ?? 0) + 1;
  }
  const totalTickets = Object.values(countByStatus).reduce((a, b) => a + b, 0);
  const activeCount = totalTickets - (countByStatus['completed'] ?? 0) - (countByStatus['archived'] ?? 0) - (countByStatus['triage_failed'] ?? 0);
  const overdueCount = tickets.filter((t) => dueState(t).tone === 'bad').length;
  const dueSoonCount = tickets.filter((t) => dueState(t).tone === 'warn').length;

  const kpis: KpiTileProps[] = [
    { label: 'Total tickets',   value: totalTickets, size: 'sm', footnote: 'lifetime', status: 'grey' },
    { label: 'Active',          value: activeCount,  size: 'sm', footnote: 'not closed/archived', status: activeCount === 0 ? 'green' : 'grey' },
    { label: 'Overdue',         value: overdueCount, size: 'sm', footnote: `SLA ${SLA_HOURS}h`, status: overdueCount === 0 ? 'green' : 'red' },
    { label: 'Due within 6h',   value: dueSoonCount, size: 'sm', footnote: 'active tickets', status: dueSoonCount === 0 ? 'green' : 'amber' },
    { label: 'Working',         value: countByStatus['working'] ?? 0, size: 'sm', footnote: 'in progress', status: 'grey' },
    { label: 'Awaits user',     value: countByStatus['awaits_user'] ?? 0, size: 'sm', footnote: 'waiting on you', status: 'grey' },
  ];

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Cockpit · Tasks"
        subtitle={`every ticket · nothing hidden · SLA ${SLA_HOURS}h from creation unless metadata.due_at overrides`}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0 8px', borderBottom: '1px solid #E6DFCC' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5A5A' }}>
            Ticket signals · SLA + status
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
            {kpis.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Filter by status" subtitle={`${tickets.length} of ${totalTickets} tickets shown`}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href="/cockpit/tasks"
                 style={chipStyle(filter === 'all', '#1B1B1B')}>
                All <span style={{ opacity: 0.6 }}>· {totalTickets}</span>
              </a>
              {Object.entries(countByStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([s, n]) => (
                  <a key={s} href={`/cockpit/tasks?status=${s}`}
                     style={chipStyle(filter === s, STATUS_COLOR[s] ?? '#5A5A5A')}>
                    {s} <span style={{ opacity: 0.7 }}>· {n}</span>
                  </a>
                ))}
              <BulkClear archivedCount={countByStatus['archived'] ?? 0} completedCount={countByStatus['completed'] ?? 0} />
            </div>
          </Container>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={`Tickets · ${tickets.length}`} subtitle="click a row to expand · SLA countdown top-left">
            {error ? (
              <div style={{ padding: 16, background: '#F5EDEB', border: '1px solid #E6C9BF', borderRadius: 6, color: '#B04A2F', fontSize: 12 }}>
                Error: {error.message}
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ padding: 24, color: '#5A5A5A', textAlign: 'center', fontStyle: 'italic', fontSize: 12 }}>
                No tickets matching filter.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tickets.map((t) => {
                  const meta = (t.metadata ?? {}) as Record<string, unknown>;
                  const lastSpec = meta.last_specialist as string | undefined;
                  const evidence = meta.evidence as Record<string, unknown> | undefined;
                  const prUrl = t.pr_url || (evidence?.pr_url as string) || (meta.pr_url as string) || null;
                  const previewUrl = t.preview_url || (evidence?.preview_url as string) || null;
                  const due = dueState(t);
                  const summary = (t.parsed_summary ?? t.email_subject ?? "(no summary)").trim();
                  return (
                    <details key={t.id}
                      style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, padding: '10px 14px' }}>
                      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                        <span style={{ fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)', color: '#5A5A5A', fontSize: 11, minWidth: 48 }}>#{t.id}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: STATUS_COLOR[t.status] ?? '#9AA0A6', color: '#FFFFFF', fontSize: 11, fontWeight: 600, minWidth: 80, textAlign: 'center' }}>{t.status}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: TONE_BG[due.tone], color: TONE_FG[due.tone], fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 110, textAlign: 'center' }}>{due.label}</span>
                        <span style={{ color: '#1B1B1B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.replace(/\n/g, ' · ').slice(0, 200)}</span>
                        <span style={{ color: '#5A5A5A', fontSize: 11, fontFamily: 'var(--mono, ui-monospace, monospace)' }}>{relTime(t.updated_at)} ago</span>
                        <TicketRowActions id={t.id} status={t.status} />
                      </summary>

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E6DFCC', display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#5A5A5A', flexWrap: 'wrap' }}>
                          <span><strong style={{ color: '#1B1B1B' }}>Created:</strong> {new Date(t.created_at).toLocaleString()}</span>
                          <span><strong style={{ color: '#1B1B1B' }}>Updated:</strong> {new Date(t.updated_at).toLocaleString()}</span>
                          {t.closed_at && <span><strong style={{ color: '#1B1B1B' }}>Closed:</strong> {new Date(t.closed_at).toLocaleString()}</span>}
                          <span><strong style={{ color: '#1B1B1B' }}>Arm:</strong> {t.arm ?? '—'}</span>
                          <span><strong style={{ color: '#1B1B1B' }}>Intent:</strong> {t.intent ?? '—'}</span>
                          <span><strong style={{ color: '#1B1B1B' }}>Source:</strong> {t.source ?? '—'}</span>
                          <span><strong style={{ color: '#1B1B1B' }}>Iterations:</strong> {t.iterations ?? 0}</span>
                          {lastSpec && <span><strong style={{ color: '#1B1B1B' }}>Last specialist:</strong> {lastSpec}</span>}
                        </div>

                        {t.parsed_summary && (
                          <div>
                            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Summary</div>
                            <div style={{ color: '#1B1B1B', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.parsed_summary}</div>
                          </div>
                        )}

                        {(t.email_subject || t.email_body) && (
                          <div>
                            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Original email</div>
                            {t.email_subject && (
                              <div style={{ color: '#1B1B1B', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.email_subject}</div>
                            )}
                            {t.email_body && (
                              <div style={{ color: '#3A3A3A', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto', padding: 8, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4 }}>
                                {t.email_body}
                              </div>
                            )}
                          </div>
                        )}

                        {t.notes && (
                          <div>
                            <div style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Notes</div>
                            <div style={{ color: '#3A3A3A', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.notes}</div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                          {prUrl && <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#084838' }}>→ PR ↗</a>}
                          {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#084838' }}>→ Preview ↗</a>}
                          {t.github_issue_url && <a href={t.github_issue_url} target="_blank" rel="noopener noreferrer" style={{ color: '#084838' }}>→ GitHub issue ↗</a>}
                          <a href={`/cockpit/tasks/${t.id}`} style={{ color: '#084838' }}>→ Full ticket page</a>
                        </div>

                        {meta && Object.keys(meta).length > 0 && (
                          <details>
                            <summary style={{ cursor: 'pointer', fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Metadata JSON</summary>
                            <pre style={{ marginTop: 6, padding: 8, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4, color: '#3A3A3A', fontSize: 11, lineHeight: 1.5, overflowX: 'auto' }}>
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
          </Container>
        </div>

        <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 11, color: '#5A5A5A', marginTop: 4 }}>
          Showing {tickets.length} of {totalTickets} tickets · Refresh manually (Cmd+R) for latest
        </div>
      </DashboardPage>
    </div>
  );
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: active ? `1.5px solid ${color}` : '1px solid #E6DFCC',
    background: active ? color : '#FFFFFF',
    color: active ? '#FFFFFF' : color,
    borderRadius: 4,
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 600,
  };
}
