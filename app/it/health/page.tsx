// app/it/health/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type AgentHealth = {
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

function healthPillVariant(state: string): 'green' | 'yellow' | 'red' | 'grey' {
  switch (state) {
    case 'healthy':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'failing':
      return 'red';
    default:
      return 'grey';
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
    .order('health_state', { ascending: true })
    .limit(100);

  const rows: AgentHealth[] = data ?? [];

  const total = rows.length;
  const healthy = rows.filter((r) => r.health_state === 'healthy').length;
  const failing = rows.filter((r) => r.health_state === 'failing').length;
  const stale = rows.filter((r) => r.health_state === 'never_run_stale').length;
  const archived = rows.filter((r) => !r.active).length;

  const columns = [
    { key: 'agent_id', header: 'ID' },
    { key: 'role', header: 'Role' },
    { key: 'department', header: 'Dept' },
    { key: 'recent_calls', header: 'Calls (recent)' },
    { key: 'recent_failures', header: 'Failures' },
    { key: 'minutes_since_last_call', header: 'Min Since Last Call' },
    { key: 'last_call_at', header: 'Last Call' },
    { key: 'health_state', header: 'Health' },
  ];

  const tableRows = rows.map((r) => ({
    ...r,
    minutes_since_last_call:
      r.minutes_since_last_call != null
        ? `${Math.round(r.minutes_since_last_call)} min`
        : '—',
    last_call_at: r.last_call_at
      ? new Date(r.last_call_at).toISOString().slice(0, 16).replace('T', ' ')
      : '—',
    health_state: (
      <StatusPill
        label={r.health_state}
        variant={healthPillVariant(r.health_state)}
      />
    ),
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'sans-serif' }}>
      <PageHeader pillar="IT" tab="Health" title="Agent Health Monitor" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Agents" value={total} />
        <KpiBox label="Healthy" value={healthy} />
        <KpiBox label="Failing" value={failing} />
        <KpiBox label="Never Run / Stale" value={stale} />
        <KpiBox label="Archived" value={archived} />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
