// app/revenue/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PlRow {
  period_label?: string;
  total_revenue?: number | null;
  rooms_revenue?: number | null;
  fb_revenue?: number | null;
  other_revenue?: number | null;
  occupancy_pct?: number | null;
  adr_usd?: number | null;
  revpar_usd?: number | null;
  rooms_sold?: number | null;
}

export default async function RevenuePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('v_pl_monthly_usali')
    .select('*')
    .order('period_label', { ascending: false })
    .limit(12);

  const rows: PlRow[] = data ?? [];
  const latest = rows[0] ?? {};

  const fmt = (v: number | null | undefined, prefix = '$') =>
    v != null ? `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(1)}%` : '—';

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Overview" title="Revenue Overview" />

      {/* KPI grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Revenue" value={fmt(latest.total_revenue)} />
        <KpiBox label="Rooms Revenue" value={fmt(latest.rooms_revenue)} />
        <KpiBox label="ADR" value={fmt(latest.adr_usd)} />
        <KpiBox label="RevPAR" value={fmt(latest.revpar_usd)} />
        <KpiBox label="Occupancy" value={fmtPct(latest.occupancy_pct)} />
        <KpiBox label="Rooms Sold" value={latest.rooms_sold?.toLocaleString() ?? '—'} />
        <KpiBox label="F&B Revenue" value={fmt(latest.fb_revenue)} />
        <KpiBox label="Other Revenue" value={fmt(latest.other_revenue)} />
      </div>

      {/* Monthly breakdown table */}
      <DataTable
        columns={[
          { key: 'period_label', header: 'Period' },
          {
            key: 'total_revenue',
            header: 'Total Revenue',
            render: (v: unknown) =>
              v != null ? `$${(v as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
          },
          {
            key: 'rooms_revenue',
            header: 'Rooms Revenue',
            render: (v: unknown) =>
              v != null ? `$${(v as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
          },
          {
            key: 'fb_revenue',
            header: 'F&B Revenue',
            render: (v: unknown) =>
              v != null ? `$${(v as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—',
          },
          {
            key: 'occupancy_pct',
            header: 'Occ %',
            render: (v: unknown) =>
              v != null ? `${(v as number).toFixed(1)}%` : '—',
          },
          {
            key: 'adr_usd',
            header: 'ADR',
            render: (v: unknown) =>
              v != null ? `$${(v as number).toFixed(2)}` : '—',
          },
          {
            key: 'revpar_usd',
            header: 'RevPAR',
            render: (v: unknown) =>
              v != null ? `$${(v as number).toFixed(2)}` : '—',
          },
          {
            key: 'rooms_sold',
            header: 'Rooms Sold',
            render: (v: unknown) =>
              v != null ? (v as number).toLocaleString() : '—',
          },
        ]}
        rows={rows}
      />
    </main>
  );
}
