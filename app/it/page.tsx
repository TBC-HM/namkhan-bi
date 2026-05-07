// app/it/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Incident {
  id: number;
  detected_at: string | null;
  resolved_at: string | null;
  severity: number | null;
  symptom: string | null;
  root_cause: string | null;
  fix: string | null;
  auto_resolved: boolean | null;
  rollback_attempted: boolean | null;
  mttr_minutes: number | null;
  source: string | null;
}

interface Ticket {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  arm: string | null;
  intent: string | null;
  status: string | null;
  source: string | null;
  parsed_summary: string | null;
}

const SEVERITY_LABEL: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Info',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Vientiane',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ITPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: incidentData }, { data: ticketData }] = await Promise.all([
    supabase
      .from('cockpit_incidents')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50),
    supabase
      .from('cockpit_tickets')
      .select('id, created_at, updated_at, arm, intent, status, source, parsed_summary')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const incidents: Incident[] = incidentData ?? [];
  const tickets: Ticket[] = ticketData ?? [];

  // KPI: open incidents (no resolved_at), by severity
  const openIncidents = incidents.filter((i) => !i.resolved_at);
  const criticalOpen = openIncidents.filter((i) => (i.severity ?? 4) <= 2).length;
  const openCount = openIncidents.filter((i) => (i.severity ?? 4) <= 3).length;
  const avgMttr = (() => {
    const resolved = incidents.filter((i) => i.mttr_minutes != null);
    if (!resolved.length) return '—';
    const avg = resolved.reduce((s, i) => s + (i.mttr_minutes ?? 0), 0) / resolved.length;
    return `${Math.round(avg)} min`;
  })();

  // KPI: ticket breakdown
  const openTickets = tickets.filter((t) => !['completed', 'closed'].includes(t.status ?? ''));
  const failedTickets = tickets.filter((t) => t.status === 'triage_failed').length;

  const incidentColumns = [
    { key: 'id', header: 'ID' },
    { key: 'detected_at_fmt', header: 'Detected (LAK)' },
    { key: 'resolved_at_fmt', header: 'Resolved (LAK)' },
    { key: 'severity_label', header: 'Severity' },
    { key: 'source', header: 'Source' },
    { key: 'symptom_short', header: 'Symptom' },
    { key: 'mttr_minutes', header: 'MTTR (min)' },
  ];

  const incidentRows = incidents.map((i) => ({
    id: i.id,
    detected_at_fmt: fmtDate(i.detected_at),
    resolved_at_fmt: i.resolved_at ? fmtDate(i.resolved_at) : '—',
    severity_label: SEVERITY_LABEL[i.severity ?? 4] ?? String(i.severity ?? '—'),
    source: i.source ?? '—',
    symptom_short:
      i.symptom && i.symptom.length > 60 ? i.symptom.slice(0, 60) + '…' : (i.symptom ?? '—'),
    mttr_minutes: i.mttr_minutes ?? '—',
  }));

  const ticketColumns = [
    { key: 'id', header: '#' },
    { key: 'created_at_fmt', header: 'Created (LAK)' },
    { key: 'arm', header: 'Arm' },
    { key: 'intent', header: 'Intent' },
    { key: 'status', header: 'Status' },
    { key: 'source', header: 'Source' },
    { key: 'summary_short', header: 'Summary' },
  ];

  const ticketRows = tickets.map((t) => ({
    id: t.id,
    created_at_fmt: fmtDate(t.created_at),
    arm: t.arm ?? '—',
    intent: t.intent ?? '—',
    status: t.status ?? '—',
    source: t.source ?? '—',
    summary_short: (() => {
      const raw = t.parsed_summary ?? '';
      // strip markdown bold/headings — first plain line
      const firstLine = raw.replace(/\*\*/g, '').split('\n').find((l) => l.trim().length > 4) ?? '';
      return firstLine.length > 70 ? firstLine.slice(0, 70) + '…' : firstLine || '—';
    })(),
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'inherit' }}>
      <PageHeader pillar="IT" tab="Dashboard" title="IT Manager Dashboard" />

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Open Incidents" value={openCount} />
        <KpiBox label="Critical / High Open" value={criticalOpen} />
        <KpiBox label="Avg MTTR" value={avgMttr} />
        <KpiBox label="Open Tickets" value={openTickets.length} />
        <KpiBox label="Triage Failed" value={failedTickets} />
      </div>

      {/* Incidents table */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
            color: 'var(--color-text-primary, #1a1a1a)',
          }}
        >
          Recent Incidents{' '}
          <span style={{ fontWeight: 400, color: '#666', fontSize: 13 }}>
            (last {incidents.length})
          </span>
        </h2>
        <DataTable columns={incidentColumns} rows={incidentRows} />
      </section>

      {/* Tickets table */}
      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
            color: 'var(--color-text-primary, #1a1a1a)',
          }}
        >
          Agent Tickets{' '}
          <span style={{ fontWeight: 400, color: '#666', fontSize: 13 }}>
            (last {tickets.length})
          </span>
        </h2>
        <DataTable columns={ticketColumns} rows={ticketRows} />
      </section>
    </main>
  );
}
