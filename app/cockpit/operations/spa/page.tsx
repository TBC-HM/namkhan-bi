// app/cockpit/operations/spa/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SpaRow {
  date?: string | null;
  revenue?: number | null;
  treatments?: number | null;
  avg_revenue_per_treatment?: number | null;
  occupancy_pct?: number | null;
  top_treatment?: string | null;
  guests_served?: number | null;
  retail_revenue?: number | null;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // v_spa_summary is not yet in the view allowlist — fall back to
  // cockpit_kpi_snapshots until a dedicated spa view is published.
  const { data } = await supabase
    .from('cockpit_kpi_snapshots')
    .select('*')
    .order('date', { ascending: false })
    .limit(30);

  const rows: SpaRow[] = (data ?? []) as SpaRow[];
  const latest: SpaRow = rows[0] ?? {};

  const fmt = (v: number | null | undefined, prefix = '') =>
    v != null ? `${prefix}${v.toLocaleString()}` : '—';

  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(1)}%` : '—';

  const tableColumns = [
    { key: 'date',                       header: 'Date' },
    { key: 'revenue',                    header: 'Revenue (USD)' },
    { key: 'treatments',                 header: 'Treatments' },
    { key: 'avg_revenue_per_treatment',  header: 'Avg / Treatment' },
    { key: 'occupancy_pct',             header: 'Occ %' },
    { key: 'guests_served',             header: 'Guests Served' },
    { key: 'retail_revenue',            header: 'Retail Revenue' },
    { key: 'top_treatment',             header: 'Top Treatment' },
  ];

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Operations" tab="Spa" title="Spa & Wellness" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Revenue"
          value={fmt(latest.revenue as number | null, '$')}
        />
        <KpiBox
          label="Treatments"
          value={fmt(latest.treatments as number | null)}
        />
        <KpiBox
          label="Avg / Treatment"
          value={fmt(latest.avg_revenue_per_treatment as number | null, '$')}
        />
        <KpiBox
          label="Occupancy"
          value={fmtPct(latest.occupancy_pct as number | null)}
        />
        <KpiBox
          label="Guests Served"
          value={fmt(latest.guests_served as number | null)}
        />
        <KpiBox
          label="Retail Revenue"
          value={fmt(latest.retail_revenue as number | null, '$')}
        />
      </div>

      <DataTable columns={tableColumns} rows={rows} />
    </main>
  );
}
