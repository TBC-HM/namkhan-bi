// app/it/health/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type Incident = {
  id: number;
  detected_at: string;
  resolved_at: string | null;
  severity: number;
  symptom: string;
  root_cause: string | null;
  fix: string | null;
  auto_resolved: boolean;
  rollback_attempted: boolean;
  mttr_minutes: number | null;
  source: string;
};

type AuditRow = {
  id: number;
  created_at: string;
  agent: string;
  action: string;
  target: string;
  success: boolean;
  cost_usd_milli: number | null;
  duration_ms: number | null;
};

const SEVERITY_LABEL: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Info',
};

function severityLabel(s: number): string {
  return SEVERITY_LABEL[s] ?? `Sev ${s}`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: incidents }, { data: auditRaw }] = await Promise.all([
    supabase
      .from('cockpit_incidents')
      .select('id,detected_at,resolved_at,severity,symptom,root_cause,fix,auto_resolved,rollback_attempted,mttr_minutes,source')
      .order('detected_at', { ascending: false })
      .limit(50),
    supabase
      .from('cockpit_audit_log')
      .select('id,created_at,agent,action,target,success,cost_usd_milli,duration_ms')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const rows: Incident[] = incidents ?? [];
  const auditRows: AuditRow[] = auditRaw ?? [];

  // KPI derivations
  const openIncidents = rows.filter((r) => !r.resolved_at && r.severity <= 3).length;
  const resolvedWithMttr = rows.filter((r) => r.mttr_minutes !== null);
  const avgMttr =
    resolvedWithMttr.length > 0
      ? (
          resolvedWithMttr.reduce((sum, r) => sum + (r.mttr_minutes ?? 0), 0) /
          resolvedWithMttr.length
        ).toFixed(1)
      : '—';

  const totalAuditOps = auditRows.length;
  const successRate =
    totalAuditOps > 0
      ? ((auditRows.filter((r) => r.success).length / totalAuditOps) * 100).toFixed(1) + '%'
      : '—';

  const totalCostUsd =
    auditRows.reduce((sum, r) => sum + (r.cost_usd_milli ?? 0), 0) / 1000;

  return (
    <main style={{ padding: '24px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="IT" tab="Health" title="System Health" />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Open Incidents" value={String(openIncidents)} />
        <KpiBox label="Avg MTTR (min)" value={String(avgMttr)} />
        <KpiBox label="Agent Op Success" value={successRate} />
        <KpiBox label="Agent Cost (USD)" value={`$${totalCostUsd.toFixed(3)}`} />
      </div>

      {/* Incidents Table */}
      <h2 style={{ marginBottom: 12 }}>Recent Incidents</h2>
      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'detected_at_fmt', header: 'Detected' },
          { key: 'severity_label', header: 'Severity' },
          { key: 'symptom', header: 'Symptom' },
          { key: 'source', header: 'Source' },
          { key: 'resolved', header: 'Resolved' },
          { key: 'mttr_minutes', header: 'MTTR (min)' },
          { key: 'auto_resolved', header: 'Auto-resolved' },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          detected_at_fmt: r.detected_at
            ? new Date(r.detected_at).toISOString().slice(0, 16).replace('T', ' ')
            : '—',
          severity_label: severityLabel(r.severity),
          symptom: r.symptom ?? '—',
          source: r.source ?? '—',
          resolved: r.resolved_at
            ? new Date(r.resolved_at).toISOString().slice(0, 16).replace('T', ' ')
            : '—',
          mttr_minutes: r.mttr_minutes ?? '—',
          auto_resolved: r.auto_resolved ? 'Yes' : 'No',
        }))}
      />

      {/* Audit Log Table */}
      <h2 style={{ marginTop: 40, marginBottom: 12 }}>Agent Audit Log</h2>
      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'created_at_fmt', header: 'Timestamp' },
          { key: 'agent', header: 'Agent' },
          { key: 'action', header: 'Action' },
          { key: 'target', header: 'Target' },
          { key: 'success_label', header: 'Success' },
          { key: 'duration_ms', header: 'Duration (ms)' },
          { key: 'cost_usd', header: 'Cost (USD)' },
        ]}
        rows={auditRows.map((r) => ({
          id: r.id,
          created_at_fmt: r.created_at
            ? new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ')
            : '—',
          agent: r.agent ?? '—',
          action: r.action ?? '—',
          target: r.target ?? '—',
          success_label: r.success ? 'Yes' : 'No',
          duration_ms: r.duration_ms ?? '—',
          cost_usd:
            r.cost_usd_milli != null
              ? `$${(r.cost_usd_milli / 1000).toFixed(4)}`
              : '—',
        }))}
      />
    </main>
  );
}
