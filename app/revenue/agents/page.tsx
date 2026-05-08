'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import PageHeader from '@/components/layout/PageHeader';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AgentRow {
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

const HEALTH_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  healthy: 'success',
  failing: 'danger',
  never_run_stale: 'warning',
  archived: 'neutral',
};

function fmtMinutes(mins: number | null): string {
  if (mins === null) return '—';
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m ago`;
}

export default function RevenueAgentsPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('v_agent_health')
        .select('*')
        .eq('department', 'revenue')
        .order('health_state')
        .limit(100);
      setRows((data as AgentRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const total = rows.length;
  const healthy = rows.filter((r) => r.health_state === 'healthy').length;
  const failing = rows.filter((r) => r.health_state === 'failing').length;
  const stale = rows.filter((r) => r.health_state === 'never_run_stale').length;
  const totalCalls = rows.reduce((sum, r) => sum + (r.recent_calls ?? 0), 0);

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
          variant={HEALTH_VARIANT[row.health_state] ?? 'neutral'}
        />
      ),
    },
    { key: 'recent_calls', header: 'Calls (recent)' },
    { key: 'recent_failures', header: 'Failures' },
    {
      key: 'last_call_at',
      header: 'Last Active',
      render: (row: AgentRow) => fmtMinutes(row.minutes_since_last_call),
    },
    {
      key: 'active',
      header: 'Active',
      render: (row: AgentRow) => (row.active ? '✓' : '—'),
    },
  ];

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Agents" title="Revenue Agents" />

      {loading ? (
        <p style={{ color: '#6b7280', marginTop: 24 }}>Loading agent data…</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              margin: '24px 0',
            }}
          >
            <KpiBox label="Total Agents" value={String(total)} />
            <KpiBox label="Healthy" value={String(healthy)} trend="up" />
            <KpiBox label="Failing" value={String(failing)} trend={failing > 0 ? 'down' : 'flat'} />
            <KpiBox label="Total Calls (recent)" value={String(totalCalls)} />
          </div>

          <div style={{ marginBottom: 8, color: '#6b7280', fontSize: 13 }}>
            {stale} agent{stale !== 1 ? 's' : ''} never run · department filter: revenue
          </div>

          <DataTable columns={columns} rows={rows} />
        </>
      )}
    </main>
  );
}
