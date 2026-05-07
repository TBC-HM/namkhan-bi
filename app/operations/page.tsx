// app/operations/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function OperationsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch recent incidents from cockpit_incidents
  const { data: incidents } = await supabase
    .from('cockpit_incidents')
    .select('id, detected_at, resolved_at, severity, symptom, root_cause, fix, auto_resolved, mttr_minutes, source')
    .order('detected_at', { ascending: false })
    .limit(50);

  const rows = incidents ?? [];

  // Derive KPI summary values
  const openIncidents = rows.filter((r) => !r.resolved_at).length;
  const resolvedIncidents = rows.filter((r) => r.resolved_at).length;
  const avgMttr = (() => {
    const withMttr = rows.filter((r) => typeof r.mttr_minutes === 'number');
    if (withMttr.length === 0) return '—';
    const avg = withMttr.reduce((sum, r) => sum + (r.mttr_minutes as number), 0) / withMttr.length;
    return `${Math.round(avg)} min`;
  })();
  const criticalCount = rows.filter((r) => (r.severity ?? 5) <= 2 && !r.resolved_at).length;

  const columns: { key: string; header: string }[] = [
    { key: 'detected_at', header: 'Detected' },
    { key: 'severity', header: 'Sev' },
    { key: 'symptom', header: 'Symptom' },
    { key: 'source', header: 'Source' },
    { key: 'root_cause', header: 'Root Cause' },
    { key: 'fix', header: 'Fix' },
    { key: 'resolved_at', header: 'Resolved' },
    { key: 'mttr_minutes', header: 'MTTR (min)' },
  ];

  // Format rows for display
  const tableRows = rows.map((r) => ({
    ...r,
    detected_at: r.detected_at ? new Date(r.detected_at).toISOString().slice(0, 16).replace('T', ' ') : '—',
    resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString().slice(0, 16).replace('T', ' ') : '—',
    severity: r.severity ?? '—',
    symptom: r.symptom ?? '—',
    source: r.source ?? '—',
    root_cause: r.root_cause ?? '—',
    fix: r.fix ?? '—',
    mttr_minutes: r.mttr_minutes != null ? r.mttr_minutes : '—',
  }));

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Operations" tab="Overview" title="Operations" />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiBox label="Open Incidents" value={String(openIncidents)} />
        <KpiBox label="Resolved (last 50)" value={String(resolvedIncidents)} />
        <KpiBox label="Critical Open" value={String(criticalCount)} />
        <KpiBox label="Avg MTTR" value={avgMttr} />
      </div>

      {/* Incidents table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Incidents</h2>
        <DataTable columns={columns} rows={tableRows} />
      </section>
    </main>
  );
}
