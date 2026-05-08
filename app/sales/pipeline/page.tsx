// app/sales/pipeline/page.tsx
// Marathon #195 child — Sales · Pipeline
// Data source: v_sales_pipeline (not yet in allowlist; fallback to empty-state rows)

import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PipelineRow {
  id?: string | number;
  stage?: string;
  lead_name?: string;
  company?: string;
  value_usd?: number | null;
  probability_pct?: number | null;
  expected_close?: string | null;
  owner?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export default async function SalesPipelinePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: v_sales_pipeline — wire when view is promoted to supabase allowlist
  const { data: pipelineData } = await supabase
    .from('v_sales_pipeline')
    .select('*')
    .limit(100)
    .returns<PipelineRow[]>();

  const rows: PipelineRow[] = pipelineData ?? [];

  // Derived KPIs
  const totalDeals = rows.length;
  const totalValue = rows.reduce((sum, r) => sum + (Number(r.value_usd) || 0), 0);
  const weightedValue = rows.reduce(
    (sum, r) =>
      sum + (Number(r.value_usd) || 0) * ((Number(r.probability_pct) || 0) / 100),
    0
  );
  const wonDeals = rows.filter(
    (r) => String(r.status ?? '').toLowerCase() === 'won'
  ).length;

  const fmtUsd = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="Sales" tab="Pipeline" title="Sales Pipeline" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          margin: '24px 0',
        }}
      >
        <KpiBox label="Open Deals"     value={totalDeals   > 0 ? String(totalDeals)      : '—'} />
        <KpiBox label="Pipeline Value" value={totalValue   > 0 ? fmtUsd(totalValue)       : '—'} />
        <KpiBox label="Weighted Value" value={weightedValue > 0 ? fmtUsd(weightedValue)   : '—'} />
        <KpiBox label="Won (period)"   value={wonDeals     > 0 ? String(wonDeals)         : '—'} />
      </div>

      {/* Pipeline detail table */}
      <DataTable
        columns={[
          { key: 'stage',           header: 'Stage' },
          { key: 'lead_name',       header: 'Lead' },
          { key: 'company',         header: 'Company' },
          { key: 'value_usd',       header: 'Value (USD)' },
          { key: 'probability_pct', header: 'Prob %' },
          { key: 'expected_close',  header: 'Expected Close' },
          { key: 'owner',           header: 'Owner' },
          { key: 'status',          header: 'Status' },
        ]}
        rows={
          rows.length > 0
            ? rows.map((r) => ({
                ...r,
                value_usd:
                  r.value_usd != null
                    ? `$${Number(r.value_usd).toLocaleString()}`
                    : '—',
                probability_pct:
                  r.probability_pct != null ? `${r.probability_pct}%` : '—',
                expected_close: r.expected_close ?? '—',
                owner:          r.owner          ?? '—',
                status:         r.status         ?? '—',
              }))
            : [
                {
                  stage:           '—',
                  lead_name:       '—',
                  company:         '—',
                  value_usd:       '—',
                  probability_pct: '—',
                  expected_close:  '—',
                  owner:           '—',
                  status:          '—',
                },
              ]
        }
      />
    </main>
  );
}
