// app/it/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── severity label helper ───────────────────────────────────────────────────
function severityLabel(sev: number | null): string {
  if (sev === null) return '—';
  if (sev <= 1) return `P${sev} · Critical`;
  if (sev === 2) return 'P2 · High';
  if (sev === 3) return 'P3 · Medium';
  return 'P4 · Info';
}

// ─── status badge colour (inline style — no Tailwind dynamic purge risk) ─────
function statusColour(status: string | null): string {
  switch (status) {
    case 'completed': return '#16a34a';
    case 'working':   return '#2563eb';
    case 'triaging':  return '#d97706';
    case 'triage_failed': return '#dc2626';
    default:          return '#6b7280';
  }
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── parallel fetches ────────────────────────────────────────────────────────
  const [incidentsRes, ticketsRes] = await Promise.all([
    supabase
      .from('cockpit_incidents')
      .select('id, detected_at, resolved_at, severity, symptom, source, auto_resolved, mttr_minutes')
      .order('detected_at', { ascending: false })
      .limit(50),
    supabase
      .from('cockpit_tickets')
      .select('id, created_at, updated_at, arm, intent, status, parsed_summary')
      .eq('arm', 'dev')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const incidents = incidentsRes.data ?? [];
  const tickets   = ticketsRes.data ?? [];

  // ── KPI derivations ─────────────────────────────────────────────────────────
  const openIncidents  = incidents.filter(i => !i.resolved_at && i.severity <= 3).length;
  const resolvedCount  = incidents.filter(i => i.resolved_at).length;
  const p4Probes       = incidents.filter(i => i.severity === 4).length;
  const avgMttr        = (() => {
    const withMttr = incidents.filter(i => typeof i.mttr_minutes === 'number');
    if (!withMttr.length) return '—';
    const avg = withMttr.reduce((s, i) => s + (i.mttr_minutes as number), 0) / withMttr.length;
    return `${Math.round(avg)} min`;
  })();

  const openTickets      = tickets.filter(t => t.status !== 'completed').length;
  const completedTickets = tickets.filter(t => t.status === 'completed').length;

  // ── table column definitions ────────────────────────────────────────────────
  const incidentColumns = [
    { key: 'id',           header: '#' },
    { key: 'detected_at',  header: 'Detected' },
    { key: 'severity_lbl', header: 'Severity' },
    { key: 'symptom',      header: 'Symptom' },
    { key: 'source',       header: 'Source' },
    { key: 'resolved_lbl', header: 'Resolved' },
    { key: 'mttr_minutes', header: 'MTTR' },
  ];

  const incidentRows = incidents.map(i => ({
    id:           i.id,
    detected_at:  i.detected_at ? new Date(i.detected_at).toISOString().slice(0, 16).replace('T', ' ') : '—',
    severity_lbl: severityLabel(i.severity),
    symptom:      i.symptom ?? '—',
    source:       i.source ?? '—',
    resolved_lbl: i.resolved_at
      ? new Date(i.resolved_at).toISOString().slice(0, 16).replace('T', ' ')
      : 'Open',
    mttr_minutes: i.mttr_minutes != null ? `${i.mttr_minutes} min` : '—',
  }));

  const ticketColumns = [
    { key: 'id',         header: '#' },
    { key: 'created_at', header: 'Created' },
    { key: 'intent',     header: 'Intent' },
    { key: 'status_lbl', header: 'Status' },
    { key: 'summary',    header: 'Summary' },
  ];

  const ticketRows = tickets.map(t => ({
    id:         t.id,
    created_at: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '—',
    intent:     t.intent ?? '—',
    status_lbl: t.status ?? '—',
    summary:    t.parsed_summary
      ? t.parsed_summary.replace(/\*\*/g, '').split('\n').find((l: string) => l.trim().length > 10)?.slice(0, 80) ?? '—'
      : '—',
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="IT" tab="Overview" title="IT Manager — Operations Overview" />

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox label="Open Incidents (P1–P3)" value={String(openIncidents)} />
        <KpiBox label="Resolved Incidents"     value={String(resolvedCount)} />
        <KpiBox label="Health Probes (P4)"     value={String(p4Probes)} />
        <KpiBox label="Avg MTTR"               value={avgMttr} />
        <KpiBox label="Dev Tickets Open"       value={String(openTickets)} />
      </div>

      {/* ── Ticket status breakdown ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        {(['triage_failed', 'triaging', 'working', 'awaits_user', 'completed'] as const).map(s => {
          const count = tickets.filter(t => t.status === s).length;
          return (
            <span
              key={s}
              style={{
                padding: '4px 12px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                backgroundColor: statusColour(s),
              }}
            >
              {s.replace(/_/g, ' ')} · {count}
            </span>
          );
        })}
        <span style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, color: '#fff', backgroundColor: '#16a34a' }}>
          completed · {completedTickets}
        </span>
      </div>

      {/* ── Incidents table ───────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Incident Log — last {incidents.length} records
        </h2>
        <DataTable columns={incidentColumns} rows={incidentRows} />
      </section>

      {/* ── Dev tickets table ─────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Dev Tickets — last {tickets.length} records
        </h2>
        <DataTable columns={ticketColumns} rows={ticketRows} />
      </section>
    </main>
  );
}
