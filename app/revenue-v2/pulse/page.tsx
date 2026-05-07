// app/revenue-v2/pulse/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface OverviewKpiRow {
  kpi_date?: string;
  date?: string;
  rooms_sold?: number | null;
  occupancy_pct?: number | null;
  adr_usd?: number | null;
  adr?: number | null;
  revpar_usd?: number | null;
  revpar?: number | null;
  revenue_usd?: number | null;
  total_revenue?: number | null;
  rooms_available?: number | null;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('f_overview_kpis')
    .select('*')
    .order('kpi_date', { ascending: false })
    .limit(30);

  const rows: OverviewKpiRow[] = data ?? [];
  const latest = rows[0] ?? {};

  // Normalise column name variants between fact table and view aliases
  const occupancy = latest.occupancy_pct ?? latest.occupancy ?? null;
  const adr = latest.adr_usd ?? latest.adr ?? null;
  const revpar = latest.revpar_usd ?? latest.revpar ?? null;
  const roomsSold = latest.rooms_sold ?? null;
  const totalRevenue = latest.revenue_usd ?? latest.total_revenue ?? null;

  const fmt = (v: number | null | undefined, prefix = '') =>
    v != null ? `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—';

  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${(v * (v <= 1 ? 100 : 1)).toFixed(1)}%` : '—';

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Pulse" title="Revenue Pulse" />

      {error && (
        <p style={{ color: '#c0392b', marginBottom: 16 }}>
          ⚠ Could not load KPI data: {error.message}
        </p>
      )}

      {/* KPI summary strip — most-recent date */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Occupancy" value={fmtPct(occupancy)} />
        <KpiBox label="ADR" value={fmt(adr, '$')} />
        <KpiBox label="RevPAR" value={fmt(revpar, '$')} />
        <KpiBox label="Rooms Sold" value={fmt(roomsSold)} />
        <KpiBox label="Total Revenue" value={fmt(totalRevenue, '$')} />
      </div>

      {/* Rolling 30-day table */}
      <DataTable
        columns={[
          { key: 'kpi_date', header: 'Date' },
          { key: 'rooms_sold', header: 'Rooms Sold' },
          { key: 'occupancy_pct', header: 'Occ %' },
          { key: 'adr_usd', header: 'ADR' },
          { key: 'revpar_usd', header: 'RevPAR' },
          { key: 'revenue_usd', header: 'Revenue' },
        ]}
        rows={rows.map((r) => ({
          kpi_date: r.kpi_date ?? r.date ?? '—',
          rooms_sold: r.rooms_sold != null ? String(r.rooms_sold) : '—',
          occupancy_pct: fmtPct(r.occupancy_pct ?? r.occupancy),
          adr_usd: fmt(r.adr_usd ?? r.adr, '$'),
          revpar_usd: fmt(r.revpar_usd ?? r.revpar, '$'),
          revenue_usd: fmt(r.revenue_usd ?? r.total_revenue, '$'),
        }))}
      />
    </main>
  );
}
