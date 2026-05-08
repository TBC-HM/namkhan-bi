// app/finance/pl/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PlRow {
  period_month?: string;
  revenue_total?: number;
  expense_total?: number;
  gop?: number;
  gop_pct?: number;
  rooms_revenue?: number;
  fb_revenue?: number;
  other_revenue?: number;
  rooms_expense?: number;
  fb_expense?: number;
  undistributed_expense?: number;
  ebitda?: number;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_pl_monthly_usali')
    .select('*')
    .order('period_month', { ascending: false })
    .limit(24);

  const rows: PlRow[] = data ?? [];
  const latest: PlRow = rows[0] ?? {};

  const fmt = (v: number | undefined, prefix = '') =>
    v == null ? '—' : `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const fmtPct = (v: number | undefined) =>
    v == null ? '—' : `${v.toFixed(1)}%`;

  return (
    <main style={{ padding: 24 }}>
      <PageHeader pillar="Finance" tab="P&L" title="Profit & Loss (USALI)" />

      {error && (
        <p style={{ color: '#c0392b', marginBottom: 16 }}>
          ⚠ Data unavailable: {error.message}
        </p>
      )}

      {/* KPI row — latest month */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Revenue" value={fmt(latest.revenue_total, '$')} />
        <KpiBox label="GOP" value={fmt(latest.gop, '$')} />
        <KpiBox label="GOP %" value={fmtPct(latest.gop_pct)} />
        <KpiBox label="EBITDA" value={fmt(latest.ebitda, '$')} />
      </div>

      {/* Revenue breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Rooms Revenue" value={fmt(latest.rooms_revenue, '$')} />
        <KpiBox label="F&B Revenue" value={fmt(latest.fb_revenue, '$')} />
        <KpiBox label="Other Revenue" value={fmt(latest.other_revenue, '$')} />
      </div>

      {/* Monthly P&L table */}
      <DataTable
        columns={[
          { key: 'period_month', header: 'Month' },
          { key: 'revenue_total', header: 'Total Revenue ($)' },
          { key: 'rooms_revenue', header: 'Rooms ($)' },
          { key: 'fb_revenue', header: 'F&B ($)' },
          { key: 'other_revenue', header: 'Other Rev ($)' },
          { key: 'expense_total', header: 'Total Expense ($)' },
          { key: 'gop', header: 'GOP ($)' },
          { key: 'gop_pct', header: 'GOP %' },
          { key: 'ebitda', header: 'EBITDA ($)' },
        ]}
        rows={rows.map((r) => ({
          ...r,
          period_month: r.period_month ?? '—',
          revenue_total: fmt(r.revenue_total),
          rooms_revenue: fmt(r.rooms_revenue),
          fb_revenue: fmt(r.fb_revenue),
          other_revenue: fmt(r.other_revenue),
          expense_total: fmt(r.expense_total),
          gop: fmt(r.gop),
          gop_pct: fmtPct(r.gop_pct),
          ebitda: fmt(r.ebitda),
        }))}
      />
    </main>
  );
}
