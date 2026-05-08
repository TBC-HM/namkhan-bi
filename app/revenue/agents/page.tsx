// app/revenue/agents/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Revenue arm tickets — no dedicated view yet; fallback to cockpit_tickets filtered by arm=revenue
  const { data: agentRows } = await supabase
    .from('cockpit_tickets')
    .select('id, arm, intent, status, parsed_summary, created_at, updated_at, source')
    .eq('arm', 'revenue')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (agentRows ?? []).map((r) => ({
    ...r,
    created_at: r.created_at ? r.created_at.slice(0, 10) : '—',
    updated_at: r.updated_at ? r.updated_at.slice(0, 10) : '—',
    parsed_summary: r.parsed_summary
      ? r.parsed_summary.slice(0, 120) + (r.parsed_summary.length > 120 ? '…' : '')
      : '—',
  }));

  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const inProgress = rows.filter((r) =>
    ['working', 'triaged', 'triage_failed'].includes(r.status)
  ).length;
  const awaiting = rows.filter((r) => r.status === 'awaits_user').length;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: '24px',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      <PageHeader pillar="Revenue" tab="Agents" title="Agents" />

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Tickets" value={String(total)} />
        <KpiBox label="Completed" value={String(completed)} />
        <KpiBox label="In Progress" value={String(inProgress)} />
        <KpiBox label="Awaiting" value={String(awaiting)} />
      </div>

      {/* Agent Tickets Table */}
      <DataTable
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'intent', header: 'Intent' },
          { key: 'status', header: 'Status' },
          { key: 'source', header: 'Source' },
          { key: 'parsed_summary', header: 'Summary' },
          { key: 'created_at', header: 'Created' },
          { key: 'updated_at', header: 'Updated' },
        ]}
        rows={rows}
      />
    </main>
  );
}
