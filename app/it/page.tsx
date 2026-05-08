// app/it/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ── severity label helpers ────────────────────────────────────────────────────
const SEVERITY_LABEL: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Informational',
};

function severityLabel(sev: number | null): string {
  if (sev == null) return '—';
  return SEVERITY_LABEL[sev] ?? `Sev ${sev}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

// ── page ─────────────────────────────────────────────────────────────────────
export default async function ITPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Incidents (last 20, most recent first, excluding informational probes)
  const { data: incidentRaw } = await supabase
    .from('cockpit_incidents')
    .select('id, detected_at, resolved_at, severity, symptom, root_cause, fix, auto_resolved, mttr_minutes, source')
    .lte('severity', 3)
    .order('detected_at', { ascending: false })
    .limit(20);

  // Open tickets for the dev arm
  const { data: ticketRaw } = await supabase
    .from('cockpit_tickets')
    .select('id, created_at, arm, intent, status, parsed_summary')
    .eq('arm', 'dev')
    .not('status', 'eq', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);

  // Mismatches (informational probes count)
  const { data: allIncidents } = await supabase
    .from('cockpit_incidents')
    .select('id, severity, resolved_at')
    .order('detected_at', { ascending: false })
    .limit(100);

  const incidents = incidentRaw ?? [];
  const tickets = ticketRaw ?? [];
  const allInc = allIncidents ?? [];

  // KPI calculations
  const openIncidents = incidents.filter((r) => !r.resolved_at).length;
  const resolvedToday = allInc.filter((r) => {
    if (!r.resolved_at) return false;
    const today = new Date().toISOString().slice(0, 10);
    return r.resolved_at.slice(0, 10) === today;
  }).length;
  const criticalOpen = incidents.filter((r) => r.severity === 1 && !r.resolved_at).length;
  const avgMttr =
    incidents.filter((r) => r.mttr_minutes != null).length > 0
      ? Math.round(
          incidents
            .filter((r) => r.mttr_minutes != null)
            .reduce((sum, r) => sum + (r.mttr_minutes ?? 0), 0) /
            incidents.filter((r) => r.mttr_minutes != null).length
        )
      : null;

  // Table columns
  const incidentColumns = [
    { key: 'detected_at', header: 'Detected' },
    { key: 'severity_label', header: 'Severity' },
    { key: 'symptom', header: 'Symptom' },
    { key: 'source', header: 'Source' },
    { key: 'status_label', header: 'Status' },
    { key: 'mttr_minutes', header: 'MTTR (min)' },
  ];

  const incidentRows = incidents.map((r) => ({
    ...r,
    detected_at: fmtDate(r.detected_at),
    severity_label: severityLabel(r.severity),
    status_label: r.resolved_at ? `✅ Resolved ${fmtDate(r.resolved_at)}` : r.auto_resolved ? '🔄 Auto-resolved' : '🔴 Open',
    mttr_minutes: r.mttr_minutes ?? '—',
    symptom: r.symptom ?? '—',
    source: r.source ?? '—',
  }));

  const ticketColumns = [
    { key: 'id', header: '#' },
    { key: 'created_at', header: 'Created' },
    { key: 'arm', header: 'Arm' },
    { key: 'intent', header: 'Intent' },
    { key: 'status', header: 'Status' },
    { key: 'summary_short', header: 'Summary' },
  ];

  const ticketRows = tickets.map((r) => ({
    ...r,
    created_at: fmtDate(r.created_at),
    summary_short: r.parsed_summary
      ? r.parsed_summary.replace(/\*\*/g, '').split('\n')[0].slice(0, 80)
      : '—',
  }));

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1280 }}>
      <PageHeader pillar="IT" tab="Overview" title="IT Manager Dashboard" />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Open Incidents"
          value={openIncidents === 0 ? '✅ None' : String(openIncidents)}
        />
        <KpiBox
          label="Critical Open"
          value={criticalOpen === 0 ? '✅ None' : `🔴 ${criticalOpen}`}
        />
        <KpiBox
          label="Resolved Today"
          value={resolvedToday === 0 ? '—' : String(resolvedToday)}
        />
        <KpiBox
          label="Avg MTTR (min)"
          value={avgMttr != null ? String(avgMttr) : '—'}
        />
      </div>

      {/* Incidents table */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
            color: '#1a1a1a',
          }}
        >
          Recent Incidents (Sev 1–3, last 20)
        </h2>
        {incidents.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            No incidents at severity 1–3 on record. System is healthy.
          </p>
        ) : (
          <DataTable columns={incidentColumns} rows={incidentRows} />
        )}
      </section>

      {/* Open dev tickets */}
      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
            color: '#1a1a1a',
          }}
        >
          Open Dev Tickets
        </h2>
        {tickets.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            No open dev tickets. Queue is clear.
          </p>
        ) : (
          <DataTable columns={ticketColumns} rows={ticketRows} />
        )}
      </section>
    </main>
  );
}
