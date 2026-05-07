// app/guest/page.tsx
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

  // mv_kpi_daily is the canonical confirmed view for daily stats
  const { data: kpiData } = await supabase
    .from('mv_kpi_daily')
    .select('*')
    .order('date', { ascending: false })
    .limit(30);

  const rows = kpiData ?? [];
  const latest = rows[0] ?? {};

  // Derive guest-relevant KPIs from daily snapshot
  const roomsSold   = latest.rooms_sold   ?? '—';
  const occupancy   = latest.occupancy_pct != null
    ? `${(Number(latest.occupancy_pct) * 100).toFixed(1)}%`
    : '—';
  const adr         = latest.adr_usd != null
    ? `$${Number(latest.adr_usd).toFixed(2)}`
    : '—';
  const revpar      = latest.revpar_usd != null
    ? `$${Number(latest.revpar_usd).toFixed(2)}`
    : '—';

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Guest" tab="Entry" title="Guest Entry" />

      {/* KPI tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Rooms Sold" value={roomsSold} />
        <KpiBox label="Occupancy" value={occupancy} />
        <KpiBox label="ADR" value={adr} />
        <KpiBox label="RevPAR" value={revpar} />
      </div>

      {/* Daily breakdown table */}
      <DataTable
        columns={[
          { key: 'date',          header: 'Date' },
          { key: 'rooms_sold',    header: 'Rooms Sold' },
          { key: 'occupancy_pct', header: 'Occupancy' },
          { key: 'adr_usd',       header: 'ADR (USD)' },
          { key: 'revpar_usd',    header: 'RevPAR (USD)' },
        ]}
        rows={rows.map((r) => ({
          date:          r.date ?? '—',
          rooms_sold:    r.rooms_sold ?? '—',
          occupancy_pct: r.occupancy_pct != null
            ? `${(Number(r.occupancy_pct) * 100).toFixed(1)}%`
            : '—',
          adr_usd:       r.adr_usd != null
            ? `$${Number(r.adr_usd).toFixed(2)}`
            : '—',
          revpar_usd:    r.revpar_usd != null
            ? `$${Number(r.revpar_usd).toFixed(2)}`
            : '—',
        }))}
      />
    </main>
  );
}
