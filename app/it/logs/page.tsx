// app/it/logs/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import DataTable from '@/components/ui/DataTable';
import KpiBox from '@/components/kpi/KpiBox';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('cockpit_audit_log')
    .select('id, created_at, agent, action, target, ticket_id, success, reasoning, input_tokens, output_tokens, cost_usd_milli, duration_ms')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = data ?? [];

  // KPI aggregates
  const totalEvents = rows.length;
  const successCount = rows.filter((r) => r.success === true).length;
  const failCount = rows.filter((r) => r.success === false).length;
  const totalCostUsd = rows.reduce((acc, r) => acc + (r.cost_usd_milli ?? 0), 0) / 1000;

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="IT" tab="Logs" title="Audit Logs" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Events (last 100)" value={String(totalEvents)} />
        <KpiBox label="Successful" value={String(successCount)} />
        <KpiBox label="Failed" value={String(failCount)} />
        <KpiBox label="Total Cost" value={`$${totalCostUsd.toFixed(4)}`} />
      </div>

      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'created_at', header: 'Timestamp' },
          { key: 'agent', header: 'Agent' },
          { key: 'action', header: 'Action' },
          { key: 'target', header: 'Target' },
          { key: 'ticket_id', header: 'Ticket' },
          { key: 'success', header: 'Success' },
          { key: 'input_tokens', header: 'Tokens In' },
          { key: 'output_tokens', header: 'Tokens Out' },
          { key: 'cost_usd_milli', header: 'Cost (m$)' },
          { key: 'duration_ms', header: 'Duration (ms)' },
          { key: 'reasoning', header: 'Reasoning' },
        ]}
        rows={rows.map((r) => ({
          id: r.id ?? '—',
          created_at: r.created_at
            ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)
            : '—',
          agent: r.agent ?? '—',
          action: r.action ?? '—',
          target: r.target ?? '—',
          ticket_id: r.ticket_id ?? '—',
          success: r.success === true ? '✓' : r.success === false ? '✗' : '—',
          input_tokens: r.input_tokens ?? '—',
          output_tokens: r.output_tokens ?? '—',
          cost_usd_milli: r.cost_usd_milli ?? '—',
          duration_ms: r.duration_ms ?? '—',
          reasoning: r.reasoning ?? '—',
        }))}
      />
    </main>
  );
}
