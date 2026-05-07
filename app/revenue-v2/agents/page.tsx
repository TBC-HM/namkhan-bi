// app/revenue-v2/agents/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type AgentRow = {
  agent_id: number;
  role: string;
  department: string;
  active: boolean;
  status: string;
  health_state: string;
  recent_calls: number;
  recent_failures: number;
  minutes_since_last_call: number | null;
  last_call_at: string | null;
};

function healthVariant(state: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (state) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'failing':
      return 'danger';
    default:
      return 'neutral';
  }
}

function fmtMinutes(mins: number | null): string {
  if (mins === null) return '—';
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m ago`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_agent_health')
    .select('*')
    .order('department', { ascending: true })
    .order('role', { ascending: true })
    .limit(100);

  const rows: AgentRow[] = data ?? [];

  // KPI summaries
  const total = rows.length;
  const healthy = rows.filter((r) => r.health_state === 'healthy').length;
  const degraded = rows.filter((r) => r.health_state === 'degraded').length;
  const failing = rows.filter((r) => r.health_state === 'failing').length;
  const archived = rows.filter((r) => !r.active).length;

  const totalCalls = rows.reduce((s, r) => s + (r.recent_calls ?? 0), 0);
  const totalFailures = rows.reduce((s, r) => s + (r.recent_failures ?? 0), 0);
  const failureRate =
    totalCalls > 0 ? `${((totalFailures / totalCalls) * 100).toFixed(1)}%` : '—';

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
      key: 'active',
      header: 'Active',
      render: (row: AgentRow) => (
        <StatusPill
          label={row.active ? 'Yes' : 'No'}
          variant={row.active ? 'success' : 'neutral'}
        />
      ),
    },
    { key: 'recent_calls', header: 'Calls (recent)' },
    { key: 'recent_failures', header: 'Failures (recent)' },
    {
      key: 'minutes_since_last_call',
      header: 'Last Active',
      render: (row: AgentRow) => fmtMinutes(row.minutes_since_last_call),
    },
    {
      key: 'last_call_at',
      header: 'Last Call At',
      render: (row: AgentRow) =>
        row.last_call_at
          ? new Date(row.last_call_at).toISOString().replace('T', ' ').slice(0, 16)
          : '—',
    },
  ];

  return (
    <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader pillar="Revenue V2" tab="Agents" title="Agent Health" />

      {error && (
        <p style={{ color: 'red', fontSize: 13 }}>
          ⚠ Could not load agent data: {error.message}
        </p>
      )}

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 16,
        }}
      >
        <KpiBox label="Total Agents" value={total} />
        <KpiBox label="Healthy" value={healthy} />
        <KpiBox label="Degraded" value={degraded} />
        <KpiBox label="Failing" value={failing} />
        <KpiBox label="Archived" value={archived} />
        <KpiBox label="Calls (recent)" value={totalCalls} />
        <KpiBox label="Failure Rate" value={failureRate} />
      </div>

      {/* Agent Table */}
      <DataTable columns={columns} rows={rows} />
    </main>
  );
}
