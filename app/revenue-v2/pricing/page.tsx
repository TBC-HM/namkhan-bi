// app/revenue-v2/pricing/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface BarLadderRow {
  rate_category?: string;
  room_type?: string;
  bar_level?: string | number;
  rate_usd?: number | null;
  rate_lak?: number | null;
  min_stay?: number | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  channel?: string | null;
  is_active?: boolean | null;
  [key: string]: unknown;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_bar_ladder')
    .select('*')
    .limit(100);

  if (error) {
    console.error('[pricing] v_bar_ladder fetch error:', error.message);
  }

  const rows: BarLadderRow[] = data ?? [];

  // Derive summary KPIs
  const activeRates = rows.filter((r) => r.is_active !== false);
  const rateCount = activeRates.length;
  const avgRateUsd =
    rateCount > 0
      ? activeRates.reduce((sum, r) => sum + (r.rate_usd ?? 0), 0) / rateCount
      : null;
  const roomTypes = new Set(rows.map((r) => r.room_type).filter(Boolean)).size;
  const barLevels = new Set(rows.map((r) => r.bar_level).filter(Boolean)).size;

  const formatUsd = (v: number | null) =>
    v != null ? `$${v.toFixed(2)}` : '—';

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Pricing" title="BAR Ladder" />

      {/* KPI summary row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Active Rates" value={rateCount > 0 ? String(rateCount) : '—'} />
        <KpiBox label="Avg BAR (USD)" value={formatUsd(avgRateUsd)} />
        <KpiBox label="Room Types" value={roomTypes > 0 ? String(roomTypes) : '—'} />
        <KpiBox label="BAR Levels" value={barLevels > 0 ? String(barLevels) : '—'} />
      </div>

      {/* Main table */}
      <DataTable
        columns={[
          { key: 'rate_category', header: 'Category' },
          { key: 'room_type',     header: 'Room Type' },
          { key: 'bar_level',     header: 'BAR Level' },
          { key: 'rate_usd',      header: 'Rate (USD)' },
          { key: 'rate_lak',      header: 'Rate (LAK)' },
          { key: 'channel',       header: 'Channel' },
          { key: 'min_stay',      header: 'Min Stay' },
          { key: 'effective_date', header: 'Effective' },
          { key: 'expiry_date',   header: 'Expires' },
          { key: 'is_active',     header: 'Active' },
        ]}
        rows={rows.map((r) => ({
          ...r,
          rate_usd:       r.rate_usd      != null ? `$${Number(r.rate_usd).toFixed(2)}`      : '—',
          rate_lak:       r.rate_lak      != null ? `₭${Number(r.rate_lak).toLocaleString()}` : '—',
          min_stay:       r.min_stay      != null ? `${r.min_stay}n`                          : '—',
          effective_date: r.effective_date ?? '—',
          expiry_date:    r.expiry_date   ?? '—',
          rate_category:  r.rate_category ?? '—',
          room_type:      r.room_type     ?? '—',
          bar_level:      r.bar_level     ?? '—',
          channel:        r.channel       ?? '—',
          is_active:      r.is_active === true ? 'Yes' : r.is_active === false ? 'No' : '—',
        }))}
      />
    </main>
  );
}
