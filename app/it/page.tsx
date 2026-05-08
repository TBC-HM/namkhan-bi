// app/it/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Incident {
  id: number;
  detected_at: string;
  resolved_at: string | null;
  severity: number;
  symptom: string;
  root_cause: string | null;
  fix: string | null;
  auto_resolved: boolean;
  mttr_minutes: number | null;
  source: string | null;
}

interface Ticket {
  id: number;
  created_at: string;
  updated_at: string;
  arm: string;
  intent: string;
  status: string;
  parsed_summary: string | null;
}

function severityLabel(n: number): string {
  if (n <= 1) return 'P1 Critical';
  if (n === 2) return 'P2 High';
  if (n === 3) return 'P3 Medium';
  return 'P4 Info';
}

export default async function Page() {
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
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const incidents: Incident[] = incidentData ?? [];
  const tickets: Ticket[] = ticketData ?? [];

  // --- KPI derivations ---
  const openIncidents = incidents.filter((i) => !i.resolved_at && i.severity <= 3);
  const criticalIncidents = incidents.filter((i) => !i.resolved_at && i.severity === 1);
  const avgMttr =
    incidents.filter((i) => i.mttr_minutes !== null).length > 0
      ? Math.round(
          incidents
            .filter((i) => i.mttr_minutes !== null)
            .reduce((sum, i) => sum + (i.mttr_minutes ?? 0), 0) /
            incidents.filter((i) => i.mttr_minutes !== null).length
        )
      : null;
  const openTickets = tickets.filter((t) => !['completed', 'closed', 'cancelled'].includes(t.status));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'inherit' }}>
      <PageHeader pillar="IT" tab="Overview" title="IT Overview" />

      {/* KPI Row */}
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
          value={openIncidents.length === 0 ? '—' : String(openIncidents.length)}
        />
        <KpiBox
          label="P1 Critical"
          value={criticalIncidents.length === 0 ? '—' : String(criticalIncidents.length)}
        />
        <KpiBox
          label="Avg MTTR (min)"
          value={avgMttr !== null ? String(avgMttr) : '—'}
        />
        <KpiBox
          label="Open Tickets"
          value={openTickets.length === 0 ? '—' : String(openTickets.length)}
        />
      </div>

      {/* Incidents Table */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
        Recent Incidents
      </h2>
      <DataTable
        columns={[
          { key: 'id', header: '#' },
          { key: 'detected_at_fmt', header: 'Detected' },
          { key: 'resolved_at_fmt', header: 'Resolved' },
          { key: 'severity_label', header: 'Severity' },
          { key: 'symptom', header: 'Symptom' },
          { key: 'source', header: 'Source' },
          { key: 'mttr_minutes', header: 'MTTR (min)' },
        ]}
        rows={incidents.map((i) => ({
          id: i.id,
          detected_at_fmt: i.detected_at
            ? new Date(i.detected_at).toISOString().slice(0, 16).replace('T', ' ')
            : '—',
          resolved_at_fmt: i.resolved_at
            ? new Date(i.resolved_at).toISOString().slice(0, 16).replace('T', ' ')
            : '—',
          severity_label: severityLabel(i.severity),
          symptom: i.symptom ?? '—',
          source: i.source ?? '—',
          mttr_minutes: i.mttr_minutes ?? '—',
        }))}
      />

      {/* Tickets Table */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 32 }}>
        Recent Tickets
      </h2>
      <DataTable
        columns={[
          { key: 'id', header: '#' },
          { key: 'created_at_fmt', header: 'Created' },
          { key: 'arm', header: 'Arm' },
          { key: 'intent', header: 'Intent' },
          { key: 'status', header: 'Status' },
        ]}
        rows={tickets.map((t) => ({
          id: t.id,
          created_at_fmt: t.created_at
            ? new Date(t.created_at).toISOString().slice(0, 16).replace('T', ' ')
            : '—',
          arm: t.arm ?? '—',
          intent: t.intent ?? '—',
          status: t.status ?? '—',
        }))}
      />
    </main>
  );
}
