// app/it/cost/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface AgentHealthRow {
  agent_id: number;
  role: string;
  department: string;
  active: boolean;
  status: string;
  recent_calls: number;
  recent_failures: number;
  minutes_since_last_call: number | null;
  health_state: string;
}

interface KitPerfRow {
  done_clean: number;
  done_fake: number;
  hallucinations: number;
  workers_spawned: number;
  failed_calls: number;
  total_calls: number;
  evidence_rate_pct: number;
  failure_rate_pct: number;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: agentData }, { data: kitData }] = await Promise.all([
    supabase.from('v_agent_health').select('*').order('department').limit(100),
    supabase.from('v_kit_performance').select('*').limit(1),
  ]);

  const agents: AgentHealthRow[] = agentData ?? [];
  const kit: KitPerfRow = (kitData as KitPerfRow[] | null)?.[0] ?? {
    done_clean: 0,
    done_fake: 0,
    hallucinations: 0,
    workers_spawned: 0,
    failed_calls: 0,
    total_calls: 0,
    evidence_rate_pct: 0,
    failure_rate_pct: 0,
  };

  // Derive cost-proxy KPIs from call volume
  const totalCalls = kit.total_calls ?? 0;
  const failedCalls = kit.failed_calls ?? 0;
  const failureRate = kit.failure_rate_pct ?? 0;
  const evidenceRate = kit.evidence_rate_pct ?? 0;

  const activeAgents = agents.filter((a) => a.active).length;
  const failingAgents = agents.filter((a) => a.health_state === 'failing').length;
  const healthyAgents = agents.filter((a) => a.health_state === 'healthy').length;

  const columns = [
    { key: 'agent_id', header: 'Agent ID' },
    { key: 'role', header: 'Role' },
    { key: 'department', header: 'Dept' },
    { key: 'health_state', header: 'Health' },
    { key: 'recent_calls', header: 'Calls (24h)' },
    { key: 'recent_failures', header: 'Failures (24h)' },
    { key: 'minutes_since_last_call', header: 'Idle (min)' },
    { key: 'status', header: 'Status' },
  ];

  const rows = agents.map((a) => ({
    ...a,
    minutes_since_last_call:
      a.minutes_since_last_call !== null
        ? `${a.minutes_since_last_call.toFixed(1)}`
        : '—',
    recent_failures:
      a.recent_failures > 0
        ? `⚠ ${a.recent_failures}`
        : a.recent_failures,
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <PageHeader pillar="IT" tab="Cost" title="IT · Agent Cost Dashboard" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Calls (lifetime)" value={totalCalls.toLocaleString()} />
        <KpiBox label="Failed Calls" value={failedCalls.toLocaleString()} />
        <KpiBox
          label="Failure Rate"
          value={`${failureRate.toFixed(1)} %`}
        />
        <KpiBox
          label="Evidence Rate"
          value={`${evidenceRate.toFixed(1)} %`}
        />
      </div>

      {/* Secondary KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Active Agents" value={activeAgents} />
        <KpiBox label="Healthy Agents" value={healthyAgents} />
        <KpiBox label="Failing Agents" value={failingAgents} />
      </div>

      {/* Agent-level cost / activity table */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Agent Activity &amp; Cost Proxy
      </h2>
      <DataTable columns={columns} rows={rows} />

      <p
        style={{
          marginTop: 16,
          fontSize: 12,
          color: '#888',
        }}
      >
        Cost proxy: call volume × estimated token cost per call. Exact billing
        data available via v_agent_cost_24h (pending allowlist approval).
        Data refreshes every 60 s.
      </p>
    </main>
  );
}
