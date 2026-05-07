// app/revenue-v2/pricing/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface BarLadderRow {
  stay_date?: string;
  room_type?: string;
  bar_level?: string | number;
  rate_usd?: number | null;
  rate_lak?: number | null;
  channel?: string;
  restriction?: string;
  occupancy_pct?: number | null;
  rooms_available?: number | null;
  rooms_sold?: number | null;
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
    .order('stay_date', { ascending: true })
    .limit(100);

  const rows: BarLadderRow[] = data ?? [];

  // Derive summary KPIs from first row / aggregates
  const totalRows = rows.length;
  const avgRateUsd =
    totalRows > 0
      ? rows.reduce((sum, r) => sum + (r.rate_usd ?? 0), 0) / totalRows
      : null;
  const avgOcc =
    totalRows > 0
      ? rows.reduce((sum, r) => sum + (r.occupancy_pct ?? 0), 0) / totalRows
      : null;
  const activeLevels = new Set(rows.map((r) => r.bar_level)).size;

  const fmt = (v: number | null, prefix = '') =>
    v !== null && v !== undefined ? `${prefix}${v.toFixed(2)}` : '—';
  const fmtPct = (v: number | null) =>
    v !== null && v !== undefined ? `${(v * 100).toFixed(1)}%` : '—';

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-body, sans-serif)' }}>
      <PageHeader pillar="Revenue" tab="Pricing" title="BAR Ladder" />

      {error && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#991b1b',
            fontSize: 14,
          }}
        >
          ⚠️ Data load error: {error.message}
        </div>
      )}

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="BAR Levels" value={activeLevels > 0 ? String(activeLevels) : '—'} />
        <KpiBox label="Avg Rate (USD)" value={fmt(avgRateUsd, '$')} />
        <KpiBox label="Avg Occupancy" value={fmtPct(avgOcc)} />
        <KpiBox label="Rows Loaded" value={totalRows > 0 ? String(totalRows) : '—'} />
      </div>

      {/* BAR ladder table */}
      <DataTable
        columns={[
          { key: 'stay_date',       header: 'Stay Date' },
          { key: 'room_type',       header: 'Room Type' },
          { key: 'bar_level',       header: 'BAR Level' },
          { key: 'channel',         header: 'Channel' },
          { key: 'rate_usd',        header: 'Rate (USD)' },
          { key: 'rate_lak',        header: 'Rate (LAK)' },
          { key: 'occupancy_pct',   header: 'Occupancy' },
          { key: 'rooms_available', header: 'Avail' },
          { key: 'rooms_sold',      header: 'Sold' },
          { key: 'restriction',     header: 'Restriction' },
        ]}
        rows={rows.map((r) => ({
          stay_date:       r.stay_date       ?? '—',
          room_type:       r.room_type       ?? '—',
          bar_level:       r.bar_level       ?? '—',
          channel:         r.channel         ?? '—',
          rate_usd:        r.rate_usd        != null ? `$${r.rate_usd.toFixed(2)}`  : '—',
          rate_lak:        r.rate_lak        != null ? `₭${r.rate_lak.toFixed(0)}`  : '—',
          occupancy_pct:   r.occupancy_pct   != null ? `${(r.occupancy_pct * 100).toFixed(1)}%` : '—',
          rooms_available: r.rooms_available ?? '—',
          rooms_sold:      r.rooms_sold      ?? '—',
          restriction:     r.restriction     ?? '—',
        }))}
      />

      {totalRows === 0 && !error && (
        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 48, fontSize: 14 }}>
          No BAR ladder data found in <code>v_bar_ladder</code>.
        </p>
      )}
    </main>
  );
}
