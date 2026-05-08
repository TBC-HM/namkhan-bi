// app/sales/pipeline/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PipelineRow {
  deal_id?: string | number;
  deal_name?: string;
  stage?: string;
  owner?: string;
  value_usd?: number | null;
  probability_pct?: number | null;
  expected_close_date?: string | null;
  last_activity_date?: string | null;
  notes?: string | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_pipeline_active')
    .select('*')
    .order('expected_close_date', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[sales/pipeline] Supabase error:', error.message);
  }

  const rows: PipelineRow[] = data ?? [];

  // KPI aggregates
  const totalDeals = rows.length;
  const totalValueUsd = rows.reduce((sum, r) => sum + (r.value_usd ?? 0), 0);
  const weightedValue = rows.reduce(
    (sum, r) => sum + (r.value_usd ?? 0) * ((r.probability_pct ?? 0) / 100),
    0
  );
  const avgProbability =
    totalDeals > 0
      ? rows.reduce((sum, r) => sum + (r.probability_pct ?? 0), 0) / totalDeals
      : 0;

  const fmtUsd = (v: number) =>
    v === 0 ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const columns = [
    { key: 'deal_name', header: 'Deal' },
    { key: 'stage', header: 'Stage' },
    { key: 'owner', header: 'Owner' },
    {
      key: 'value_usd',
      header: 'Value (USD)',
      render: (row: PipelineRow) =>
        row.value_usd != null ? fmtUsd(row.value_usd) : '—',
    },
    {
      key: 'probability_pct',
      header: 'Probability',
      render: (row: PipelineRow) =>
        row.probability_pct != null ? `${row.probability_pct}%` : '—',
    },
    {
      key: 'expected_close_date',
      header: 'Expected Close',
      render: (row: PipelineRow) => row.expected_close_date ?? '—',
    },
    {
      key: 'last_activity_date',
      header: 'Last Activity',
      render: (row: PipelineRow) => row.last_activity_date ?? '—',
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row: PipelineRow) => row.notes ?? '—',
    },
  ];

  return (
    <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader pillar="Sales" tab="Pipeline" title="Sales Pipeline" />

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiBox
          label="Active Deals"
          value={totalDeals === 0 ? '—' : String(totalDeals)}
        />
        <KpiBox
          label="Pipeline Value"
          value={fmtUsd(totalValueUsd)}
        />
        <KpiBox
          label="Weighted Value"
          value={fmtUsd(weightedValue)}
        />
        <KpiBox
          label="Avg Probability"
          value={avgProbability === 0 ? '—' : `${avgProbability.toFixed(1)}%`}
        />
      </div>

      {/* Pipeline Table */}
      <DataTable
        columns={columns}
        rows={rows}
        emptyMessage="No active pipeline deals found."
      />
    </main>
  );
}
