// app/revenue-v2/agents/page.tsx
// Wired to public.v_agent_health — ticket #107 slice
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import PageHeader from '@/components/layout/PageHeader';

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

function healthColor(state: string): 'green' | 'yellow' | 'red' | 'grey' {
  switch (state) {
    case 'healthy':        return 'green';
    case 'new':            return 'yellow';
    case 'never_run_stale':return 'red';
    case 'archived':       return 'grey';
    default:               return 'grey';
  }
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('v_agent_health')
    .select('*')
    .order('department', { ascending: true })
    .order('role', { ascending: true })
    .limit(100);

  const rows: AgentRow[] = data ?? [];

  const total   = rows.length;
  const healthy = rows.filter(r => r.health_state === 'healthy').length;
  const stale   = rows.filter(r => r.health_state === 'never_run_stale').length;
  const archived = rows.filter(r => r.health_state === 'archived').length;

  const activeRows = rows.filter(r => r.active);

  const columns = [
    { key: 'agent_id',   header: 'ID'         },
    { key: 'role',       header: 'Role'        },
    { key: 'department', header: 'Department'  },
    {
      key: 'health_state',
      header: 'Health',
      render: (row: AgentRow) => (
        <StatusPill color={healthColor(row.health_state)} label={row.health_state} />
      ),
    },
    { key: 'recent_calls',    header: 'Calls (24 h)'   },
    { key: 'recent_failures', header: 'Failures (24 h)' },
    {
      key: 'minutes_since_last_call',
      header: 'Last Call (min ago)',
      render: (row: AgentRow) =>
        row.minutes_since_last_call != null
          ? String(row.minutes_since_last_call)
          : '—',
    },
    {
      key: 'last_call_at',
      header: 'Last Call At',
      render: (row: AgentRow) =>
        row.last_call_at
          ? new Date(row.last_call_at).toISOString().slice(0, 16).replace('T', ' ')
          : '—',
    },
    {
      key: 'active',
      header: 'Active',
      render: (row: AgentRow) => (row.active ? 'Yes' : 'No'),
    },
  ];

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Agents" title="Agent Health" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Agents"    value={String(total)}   />
        <KpiBox label="Healthy"         value={String(healthy)} />
        <KpiBox label="Never-Run/Stale" value={String(stale)}   />
        <KpiBox label="Archived"        value={String(archived)} />
      </div>

      {/* Active agents table */}
      <DataTable
        columns={columns}
        rows={activeRows}
      />
    </main>
  );
}
