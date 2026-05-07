// app/revenue-v2/pricing/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function PricingPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_bar_ladder')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(60);

  const rows = data ?? [];

  // Derive headline KPIs from first available row
  const latest = rows[0] ?? {};
  const avgBar = rows.length > 0
    ? (rows.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.bar_rate) || 0), 0) / rows.length).toFixed(2)
    : '—';

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Pricing" title="BAR Ladder" />

      {error && (
        <p style={{ color: '#ef4444', marginBottom: 16 }}>
          ⚠ Data error: {error.message}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiBox
          label="Ladder Rows"
          value={rows.length > 0 ? String(rows.length) : '—'}
        />
        <KpiBox
          label="Avg BAR Rate"
          value={avgBar !== '—' ? `$${avgBar}` : '—'}
        />
        <KpiBox
          label="Min BAR"
          value={
            rows.length > 0
              ? `$${Math.min(...rows.map((r: Record<string, unknown>) => Number(r.bar_rate) || 0)).toFixed(2)}`
              : '—'
          }
        />
        <KpiBox
          label="Max BAR"
          value={
            rows.length > 0
              ? `$${Math.max(...rows.map((r: Record<string, unknown>) => Number(r.bar_rate) || 0)).toFixed(2)}`
              : '—'
          }
        />
      </div>

      <DataTable
        columns={[
          { key: 'stay_date',       header: 'Stay Date' },
          { key: 'room_type',       header: 'Room Type' },
          { key: 'bar_level',       header: 'BAR Level' },
          { key: 'bar_rate',        header: 'BAR Rate ($)' },
          { key: 'occupancy_pct',   header: 'OCC %' },
          { key: 'rooms_available', header: 'Rooms Avail' },
          { key: 'channel',         header: 'Channel' },
          { key: 'restriction',     header: 'Restriction' },
        ]}
        rows={rows.map((r: Record<string, unknown>) => ({
          ...r,
          stay_date:     r.stay_date     ?? '—',
          room_type:     r.room_type     ?? '—',
          bar_level:     r.bar_level     ?? '—',
          bar_rate:      r.bar_rate != null ? `$${Number(r.bar_rate).toFixed(2)}` : '—',
          occupancy_pct: r.occupancy_pct != null ? `${Number(r.occupancy_pct).toFixed(1)}%` : '—',
          rooms_available: r.rooms_available ?? '—',
          channel:       r.channel       ?? '—',
          restriction:   r.restriction   ?? '—',
        }))}
      />
    </main>
  );
}
