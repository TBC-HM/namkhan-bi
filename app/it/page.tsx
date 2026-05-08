// app/it/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ── Severity helpers ────────────────────────────────────────────────────────
const SEVERITY_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Informational',
};

function severityLabel(n: number | null): string {
  if (n == null) return '—';
  return SEVERITY_LABELS[n] ?? `Sev ${n}`;
}

function isoDate(ts: string | null): string {
  if (!ts) return '—';
  return ts.slice(0, 10);
}

// ── Page ────────────────────────────────────────────────────────────────────
export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Parallel data fetches
  const [ticketsRes, incidentsRes] = await Promise.all([
    supabase
      .from('cockpit_tickets')
      .select('id, created_at, status, arm, parsed_summary')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('cockpit_incidents')
      .select('id, detected_at, resolved_at, severity, symptom, source, auto_resolved')
      .order('detected_at', { ascending: false })
      .limit(50),
  ]);

  const tickets = ticketsRes.data ?? [];
  const incidents = incidentsRes.data ?? [];

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const openTickets = tickets.filter(
    (t) => t.status !== 'completed' && t.status !== 'closed' && t.status !== 'cancelled'
  ).length;

  const devTickets = tickets.filter((t) => t.arm === 'dev').length;

  const openIncidents = incidents.filter((i) => !i.resolved_at).length;

  const criticalIncidents = incidents.filter(
    (i) => (i.severity ?? 4) <= 2 && !i.resolved_at
  ).length;

  // ── Table column definitions ───────────────────────────────────────────────
  const ticketColumns = [
    { key: 'id',              header: 'ID'       },
    { key: 'created_at_fmt',  header: 'Created'  },
    { key: 'arm',             header: 'Arm'      },
    { key: 'status',          header: 'Status'   },
    { key: 'summary_short',   header: 'Summary'  },
  ];

  const incidentColumns = [
    { key: 'id',              header: 'ID'          },
    { key: 'detected_at_fmt', header: 'Detected'    },
    { key: 'severity_label',  header: 'Severity'    },
    { key: 'source',          header: 'Source'      },
    { key: 'symptom_short',   header: 'Symptom'     },
    { key: 'resolved',        header: 'Resolved'    },
  ];

  // ── Row shaping ────────────────────────────────────────────────────────────
  const ticketRows = tickets.map((t) => ({
    ...t,
    created_at_fmt: isoDate(t.created_at as string | null),
    arm:            t.arm ?? '—',
    status:         t.status ?? '—',
    summary_short:  typeof t.parsed_summary === 'string'
      ? t.parsed_summary.slice(0, 80).replace(/\n/g, ' ') + (t.parsed_summary.length > 80 ? '…' : '')
      : '—',
  }));

  const incidentRows = incidents.map((i) => ({
    ...i,
    detected_at_fmt: isoDate(i.detected_at as string | null),
    severity_label:  severityLabel(i.severity as number | null),
    source:          (i.source as string | null) ?? '—',
    symptom_short:   typeof i.symptom === 'string'
      ? i.symptom.slice(0, 80) + (i.symptom.length > 80 ? '…' : '')
      : '—',
    resolved:        i.resolved_at ? '✓' : i.auto_resolved ? 'Auto' : '—',
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader pillar="IT" tab="Overview" title="IT Operations" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Open Tickets"      value={String(openTickets)}      />
        <KpiBox label="Dev-Arm Tickets"   value={String(devTickets)}       />
        <KpiBox label="Open Incidents"    value={String(openIncidents)}    />
        <KpiBox label="Critical / High"   value={String(criticalIncidents)}/>
      </div>

      {/* Tickets table */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 12,
            color: '#1a1a2e',
          }}
        >
          Cockpit Tickets (last 50)
        </h2>
        <DataTable columns={ticketColumns} rows={ticketRows} />
      </section>

      {/* Incidents table */}
      <section>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 12,
            color: '#1a1a2e',
          }}
        >
          Incidents (last 50)
        </h2>
        <DataTable columns={incidentColumns} rows={incidentRows} />
      </section>
    </main>
  );
}
