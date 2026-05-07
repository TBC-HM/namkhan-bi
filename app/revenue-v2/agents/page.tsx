// app/revenue-v2/agents/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type AgentRow = {
  agent_id: number;
  role: string;
  department: string;
  active: boolean;
  status: string;
  created_at: string;
  last_call_at: string | null;
  recent_failures: number;
  recent_calls: number;
  minutes_since_last_call: number | null;
  health_state: string;
};

function healthVariant(
  state: string
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (state) {
    case 'healthy':
      return 'success';
    case 'failing':
      return 'danger';
    case 'never_run_stale':
      return 'warning';
    case 'archived':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—';
  return `${val}${suffix}`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('v_agent_health')
    .select('*')
    .order('health_state', { ascending: true })
    .order('role', { ascending: true });

  const rows: AgentRow[] = data ?? [];

  const total = rows.length;
  const healthy = rows.filter((r) => r.health_state === 'healthy').length;
  const failing = rows.filter((r) => r.health_state === 'failing').length;
  const stale = rows.filter((r) => r.health_state === 'never_run_stale').length;
  const archived = rows.filter((r) => r.health_state === 'archived').length;

  const columns = [
    { key: 'agent_id', header: 'ID' },
    { key: 'role', header: 'Role' },
    { key: 'department', header: 'Dept' },
    {
      key: 'health_state',
      header: 'Health',
      render: (row: AgentRow) => (
        <StatusPill
          label={row.health_state.replace(/_/g, ' ')}
          variant={healthVariant(row.health_state)}
        />
      ),
    },
    {
      key: 'recent_calls',
      header: 'Calls (recent)',
      render: (row: AgentRow) => fmt(row.recent_calls),
    },
    {
      key: 'recent_failures',
      header: 'Failures',
      render: (row: AgentRow) =>
        row.recent_failures > 0 ? (
          <span style={{ color: '#dc2626', fontWeight: 600 }}>
            {row.recent_failures}
          </span>
        ) : (
          <span>{fmt(row.recent_failures)}</span>
        ),
    },
    {
      key: 'minutes_since_last_call',
      header: 'Last call (min ago)',
      render: (row: AgentRow) =>
        row.minutes_since_last_call !== null
          ? `${Math.round(row.minutes_since_last_call)} min`
          : '—',
    },
    {
      key: 'active',
      header: 'Active',
      render: (row: AgentRow) => (
        <StatusPill
          label={row.active ? 'Yes' : 'No'}
          variant={row.active ? 'success' : 'neutral'}
        />
      ),
    },
  ];

  return (
    <main style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader pillar="Revenue" tab="Agents" title="Agent Health" />

      {/* KPI summary row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          margin: '24px 0',
        }}
      >
        <KpiBox label="Total Agents" value={String(total)} />
        <KpiBox label="Healthy" value={String(healthy)} />
        <KpiBox
          label="Failing"
          value={String(failing)}
        />
        <KpiBox label="Never Run / Stale" value={String(stale)} />
        <KpiBox label="Archived" value={String(archived)} />
      </div>

      {/* Full roster table */}
      <DataTable
        columns={columns}
        rows={rows}
      />
    </main>
  );
}
