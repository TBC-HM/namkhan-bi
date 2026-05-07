// app/revenue-v2/pricing/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface BarLadderRow {
  rate_category?: string | null;
  room_type?: string | null;
  bar_level?: string | number | null;
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
    .limit(120);

  if (error) {
    console.error('[pricing] v_bar_ladder fetch error:', error.message);
  }

  const rows: BarLadderRow[] = data ?? [];

  const activeRates = rows.filter((r) => r.is_active !== false);
  const rateCount = activeRates.length;
  const avgRateUsd =
    rateCount > 0
      ? activeRates.reduce((sum, r) => sum + (r.rate_usd ?? 0), 0) / rateCount
      : null;
  const roomTypes = new Set(rows.map((r) => r.room_type).filter(Boolean)).size;
  const barLevels = new Set(rows.map((r) => r.bar_level).filter(Boolean)).size;

  const fmtUsd = (v: number | null | undefined): string =>
    v != null ? `$${v.toFixed(2)}` : '\u2014';

  const tableRows = rows.map((r) => ({
    rate_category: r.rate_category ?? '\u2014',
    room_type: r.room_type ?? '\u2014',
    bar_level: r.bar_level ?? '\u2014',
    rate_usd:
      r.rate_usd != null
        ? `$${Number(r.rate_usd).toFixed(2)}`
        : '\u2014',
    rate_lak:
      r.rate_lak != null
        ? `\u20ADK${Number(r.rate_lak).toLocaleString()}`
        : '\u2014',
    min_stay: r.min_stay != null ? `${r.min_stay}n` : '\u2014',
    effective_date: r.effective_date ?? '\u2014',
    expiry_date: r.expiry_date ?? '\u2014',
    channel: r.channel ?? '\u2014',
    is_active:
      r.is_active === true ? 'Yes' : r.is_active === false ? 'No' : '\u2014',
  }));

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Pricing" title="BAR Ladder" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Active Rates"
          value={rateCount > 0 ? String(rateCount) : '\u2014'}
        />
        <KpiBox
          label="Avg BAR (USD)"
          value={fmtUsd(avgRateUsd)}
        />
        <KpiBox
          label="Room Types"
          value={roomTypes > 0 ? String(roomTypes) : '\u2014'}
        />
        <KpiBox
          label="BAR Levels"
          value={barLevels > 0 ? String(barLevels) : '\u2014'}
        />
      </div>

      <DataTable
        columns={[
          { key: 'rate_category', header: 'Category' },
          { key: 'room_type',     header: 'Room Type' },
          { key: 'bar_level',     header: 'BAR Level' },
          { key: 'rate_usd',      header: 'Rate (USD)' },
          { key: 'rate_lak',      header: 'Rate (LAK)' },
          { key: 'channel',       header: 'Channel' },
          { key: 'min_stay',      header: 'Min Stay' },
          { key: 'effective_date',header: 'Effective' },
          { key: 'expiry_date',   header: 'Expires' },
          { key: 'is_active',     header: 'Active' },
        ]}
        rows={tableRows}
      />
    </main>
  );
}
