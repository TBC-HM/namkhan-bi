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
  source: string | null;
  parsed_summary: string | null;
}

function severityLabel(s: number): string {
  if (s <= 1) return 'Critical';
  if (s === 2) return 'High';
  if (s === 3) return 'Medium';
  if (s === 4) return 'Informational';
  return String(s);
}

function severityColor(s: number): string {
  if (s <= 1) return '#ef4444'; // red
  if (s === 2) return '#f97316'; // orange
  if (s === 3) return '#eab308'; // yellow
  return '#6b7280'; // gray
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch recent incidents (most severe first, then newest)
  const { data: incidentData } = await supabase
    .from('cockpit_incidents')
    .select(
      'id, detected_at, resolved_at, severity, symptom, root_cause, fix, auto_resolved, mttr_minutes, source'
    )
    .order('severity', { ascending: true })
    .order('detected_at', { ascending: false })
    .limit(50);

  // Fetch recent dev tickets
  const { data: ticketData } = await supabase
    .from('cockpit_tickets')
    .select('id, created_at, updated_at, arm, intent, status, source, parsed_summary')
    .order('created_at', { ascending: false })
    .limit(50);

  const incidents: Incident[] = incidentData ?? [];
  const tickets: Ticket[] = ticketData ?? [];

  // KPI derivations
  const openIncidents = incidents.filter((i) => i.resolved_at === null && i.severity <= 3).length;
  const criticalCount = incidents.filter((i) => i.severity <= 1).length;
  const avgMttr =
    incidents.filter((i) => i.mttr_minutes !== null).length > 0
      ? Math.round(
          incidents
            .filter((i) => i.mttr_minutes !== null)
            .reduce((acc, i) => acc + (i.mttr_minutes ?? 0), 0) /
            incidents.filter((i) => i.mttr_minutes !== null).length
        )
      : null;

  const openTickets = tickets.filter((t) => !['completed', 'closed'].includes(t.status)).length;

  const statusCounts: Record<string, number> = {};
  for (const t of tickets) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }

  // Truncate parsed_summary to first 80 chars for table display
  function truncate(s: string | null, n = 80): string {
    if (!s) return '—';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader pillar="IT" tab="Overview" title="IT Manager" />

      {/* ── KPI Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Open Incidents" value={openIncidents} />
        <KpiBox label="Critical (Sev ≤1)" value={criticalCount} />
        <KpiBox
          label="Avg MTTR (min)"
          value={avgMttr !== null ? String(avgMttr) : '—'}
        />
        <KpiBox label="Open Tickets" value={openTickets} />
      </div>

      {/* ── Ticket Status Summary ── */}
      {Object.keys(statusCounts).length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#6b7280',
              marginBottom: 12,
            }}
          >
            Tickets by Status
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(statusCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <div
                  key={status}
                  style={{
                    background: '#f3f4f6',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  {status}{' '}
                  <span
                    style={{
                      background: '#e5e7eb',
                      borderRadius: 12,
                      padding: '2px 8px',
                      marginLeft: 6,
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── Recent Incidents ── */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#6b7280',
            marginBottom: 12,
          }}
        >
          Recent Incidents
        </h2>
        <DataTable
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'severity_label', header: 'Severity' },
            { key: 'detected_at_fmt', header: 'Detected' },
            { key: 'resolved_at_fmt', header: 'Resolved' },
            { key: 'symptom_short', header: 'Symptom' },
            { key: 'source', header: 'Source' },
            { key: 'mttr_minutes', header: 'MTTR (min)' },
          ]}
          rows={incidents.map((i) => ({
            id: i.id,
            severity_label: severityLabel(i.severity),
            _severity_color: severityColor(i.severity),
            detected_at_fmt: i.detected_at
              ? new Date(i.detected_at).toISOString().slice(0, 16).replace('T', ' ')
              : '—',
            resolved_at_fmt: i.resolved_at
              ? new Date(i.resolved_at).toISOString().slice(0, 16).replace('T', ' ')
              : '—',
            symptom_short: truncate(i.symptom, 80),
            source: i.source ?? '—',
            mttr_minutes: i.mttr_minutes !== null ? String(i.mttr_minutes) : '—',
          }))}
        />
      </section>

      {/* ── Recent Tickets ── */}
      <section>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#6b7280',
            marginBottom: 12,
          }}
        >
          Recent Cockpit Tickets
        </h2>
        <DataTable
          columns={[
            { key: 'id', header: '#' },
            { key: 'status', header: 'Status' },
            { key: 'arm', header: 'Arm' },
            { key: 'intent', header: 'Intent' },
            { key: 'source', header: 'Source' },
            { key: 'created_at_fmt', header: 'Created' },
            { key: 'summary_short', header: 'Summary' },
          ]}
          rows={tickets.map((t) => ({
            id: t.id,
            status: t.status,
            arm: t.arm ?? '—',
            intent: t.intent ?? '—',
            source: t.source ?? '—',
            created_at_fmt: t.created_at
              ? new Date(t.created_at).toISOString().slice(0, 16).replace('T', ' ')
              : '—',
            summary_short: truncate(t.parsed_summary, 80),
          }))}
        />
      </section>
    </main>
  );
}
