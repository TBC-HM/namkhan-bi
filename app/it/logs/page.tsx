// app/it/logs/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AuditRow {
  id: number;
  created_at: string;
  agent: string | null;
  action: string | null;
  target: string | null;
  ticket_id: number | null;
  success: boolean | null;
  reasoning: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_milli: number | null;
  duration_ms: number | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('cockpit_audit_log')
    .select(
      'id, created_at, agent, action, target, ticket_id, success, reasoning, input_tokens, output_tokens, cost_usd_milli, duration_ms'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const rows: AuditRow[] = data ?? [];

  // KPI derivations
  const totalEvents = rows.length;
  const successCount = rows.filter((r) => r.success === true).length;
  const failCount = rows.filter((r) => r.success === false).length;
  const totalCostUsd =
    rows.reduce((acc, r) => acc + (r.cost_usd_milli ?? 0), 0) / 1000;
  const avgDurationMs =
    rows.length > 0
      ? rows.reduce((acc, r) => acc + (r.duration_ms ?? 0), 0) / rows.length
      : 0;

  const successRate =
    totalEvents > 0 ? ((successCount / totalEvents) * 100).toFixed(1) : '—';

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="IT" tab="Logs" title="Agent Audit Logs" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Events" value={totalEvents.toLocaleString()} />
        <KpiBox label="Success" value={successCount.toLocaleString()} />
        <KpiBox label="Failures" value={failCount.toLocaleString()} />
        <KpiBox label="Success Rate" value={totalEvents > 0 ? `${successRate}%` : '—'} />
        <KpiBox
          label="Est. Total Cost"
          value={totalEvents > 0 ? `$${totalCostUsd.toFixed(3)}` : '—'}
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
        <KpiBox
          label="Avg Duration"
          value={avgDurationMs > 0 ? `${(avgDurationMs / 1000).toFixed(2)}s` : '—'}
        />
        <KpiBox
          label="Unique Agents"
          value={new Set(rows.map((r) => r.agent).filter(Boolean)).size.toString()}
        />
        <KpiBox
          label="Unique Actions"
          value={new Set(rows.map((r) => r.action).filter(Boolean)).size.toString()}
        />
      </div>

      {/* Audit log table */}
      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          {
            key: 'created_at',
            header: 'Timestamp',
            render: (v: unknown) => {
              if (typeof v !== 'string') return '—';
              return new Date(v).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
            },
          },
          { key: 'agent', header: 'Agent' },
          { key: 'action', header: 'Action' },
          { key: 'target', header: 'Target' },
          { key: 'ticket_id', header: 'Ticket' },
          {
            key: 'success',
            header: 'Status',
            render: (v: unknown) => {
              if (v === true) return '✅ OK';
              if (v === false) return '❌ Fail';
              return '—';
            },
          },
          {
            key: 'input_tokens',
            header: 'In Tokens',
            render: (v: unknown) =>
              typeof v === 'number' ? v.toLocaleString() : '—',
          },
          {
            key: 'output_tokens',
            header: 'Out Tokens',
            render: (v: unknown) =>
              typeof v === 'number' ? v.toLocaleString() : '—',
          },
          {
            key: 'cost_usd_milli',
            header: 'Cost (¢)',
            render: (v: unknown) =>
              typeof v === 'number' ? `$${(v / 1000).toFixed(4)}` : '—',
          },
          {
            key: 'duration_ms',
            header: 'Duration',
            render: (v: unknown) =>
              typeof v === 'number' ? `${(v / 1000).toFixed(2)}s` : '—',
          },
          {
            key: 'reasoning',
            header: 'Reasoning',
            render: (v: unknown) => {
              if (typeof v !== 'string') return '—';
              return v.length > 80 ? v.slice(0, 80) + '…' : v;
            },
          },
        ]}
        rows={rows}
      />
    </main>
  );
}
