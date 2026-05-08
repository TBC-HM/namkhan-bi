// app/it/health/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface AgentHealthRow {
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
}

function healthColor(state: string): string {
  switch (state) {
    case 'healthy':       return '#16a34a'; // green-600
    case 'failing':       return '#dc2626'; // red-600
    case 'archived':      return '#6b7280'; // gray-500
    case 'never_run_stale': return '#d97706'; // amber-600
    default:              return '#6b7280';
  }
}

function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

function fmtMin(n: number | null): string {
  if (n === null || n === undefined) return '—';
  if (n < 60) return `${Math.round(n)}m`;
  return `${(n / 60).toFixed(1)}h`;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane',
  });
}

export default async function ItHealthPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('v_agent_health')
    .select('*')
    .order('health_state', { ascending: true })
    .order('recent_failures', { ascending: false })
    .limit(100);

  const rows: AgentHealthRow[] = data ?? [];

  // KPI summary counts
  const totalAgents   = rows.filter(r => r.active).length;
  const healthy       = rows.filter(r => r.health_state === 'healthy').length;
  const failing       = rows.filter(r => r.health_state === 'failing').length;
  const stale         = rows.filter(r => r.health_state === 'never_run_stale').length;
  const archived      = rows.filter(r => r.health_state === 'archived').length;

  const totalCalls    = rows.reduce((s, r) => s + (r.recent_calls ?? 0), 0);
  const totalFailures = rows.reduce((s, r) => s + (r.recent_failures ?? 0), 0);
  const failRate      = totalCalls > 0
    ? `${((totalFailures / totalCalls) * 100).toFixed(1)}%`
    : '—';

  const columns = [
    { key: 'agent_id',   header: 'ID'          },
    { key: 'role',       header: 'Role'         },
    { key: 'department', header: 'Dept'         },
    { key: 'health_state',    header: 'State'   },
    { key: 'recent_calls',    header: 'Calls'   },
    { key: 'recent_failures', header: 'Failures'},
    { key: 'minutes_since_last_call', header: 'Last Active' },
    { key: 'last_call_at', header: 'Last Call (ICT)' },
    { key: 'active',     header: 'Active'       },
  ];

  const tableRows = rows.map(r => ({
    agent_id:   r.agent_id,
    role:       r.role,
    department: r.department,
    health_state: (
      <span style={{ fontWeight: 600, color: healthColor(r.health_state) }}>
        {r.health_state.replace(/_/g, ' ')}
      </span>
    ),
    recent_calls:    fmt(r.recent_calls),
    recent_failures: r.recent_failures > 0
      ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{r.recent_failures}</span>
      : '0',
    minutes_since_last_call: fmtMin(r.minutes_since_last_call),
    last_call_at: fmtDate(r.last_call_at),
    active: <StatusPill value={r.active ? 'active' : 'inactive'} />,
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'Inter, sans-serif' }}>
      <PageHeader pillar="IT" tab="Health" title="Agent Health Monitor" />

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <KpiBox label="Active Agents"  value={String(totalAgents)} />
        <KpiBox label="Healthy"        value={String(healthy)}     />
        <KpiBox label="Failing"        value={String(failing)}     delta={failing > 0 ? `${failing} alert` : undefined} />
        <KpiBox label="Never Run"      value={String(stale)}       />
        <KpiBox label="Archived"       value={String(archived)}    />
        <KpiBox label="Total Calls"    value={fmt(totalCalls)}     />
        <KpiBox label="Fail Rate"      value={failRate}            />
      </div>

      {/* Agent table */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          All Agents ({rows.length})
        </h2>
        <DataTable columns={columns} rows={tableRows} />
      </section>
    </main>
  );
}
