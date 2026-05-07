// app/revenue-v2/rateplans/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface RateplanRow {
  rate_plan_name?: string | null;
  rate_plan_code?: string | null;
  room_nights?: number | null;
  revenue_usd?: number | null;
  adr_usd?: number | null;
  occupancy_pct?: number | null;
  revpar_usd?: number | null;
  cancellations?: number | null;
  pickup_7d?: number | null;
  period?: string | null;
}

function fmt$( v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US');
}

export default async function RatePlansPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_rateplan_performance')
    .select('*')
    .order('revenue_usd', { ascending: false })
    .limit(100);

  const rows: RateplanRow[] = data ?? [];

  // Aggregate KPI tiles
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalNights = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const avgAdr =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.adr_usd ?? 0), 0) / rows.filter((r) => r.adr_usd != null).length
      : null;
  const avgOcc =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / rows.filter((r) => r.occupancy_pct != null).length
      : null;

  const columns = [
    { key: 'rate_plan_name', header: 'Rate Plan' },
    { key: 'rate_plan_code', header: 'Code' },
    { key: 'period',         header: 'Period' },
    { key: 'room_nights',    header: 'Rm Nights' },
    { key: 'revenue_usd',    header: 'Revenue (USD)' },
    { key: 'adr_usd',        header: 'ADR' },
    { key: 'occupancy_pct',  header: 'OCC %' },
    { key: 'revpar_usd',     header: 'RevPAR' },
    { key: 'cancellations',  header: 'Cancels' },
    { key: 'pickup_7d',      header: '7d Pickup' },
  ];

  const tableRows = rows.map((r) => ({
    rate_plan_name:  r.rate_plan_name  ?? '—',
    rate_plan_code:  r.rate_plan_code  ?? '—',
    period:          r.period          ?? '—',
    room_nights:     fmtInt(r.room_nights),
    revenue_usd:     fmt$(r.revenue_usd),
    adr_usd:         fmt$(r.adr_usd),
    occupancy_pct:   fmtPct(r.occupancy_pct),
    revpar_usd:      fmt$(r.revpar_usd),
    cancellations:   fmtInt(r.cancellations),
    pickup_7d:       r.pickup_7d != null
                       ? (r.pickup_7d >= 0 ? `+${r.pickup_7d}` : `−${Math.abs(r.pickup_7d)}`)
                       : '—',
  }));

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Rate Plans" title="Rate Plan Performance" />

      {error && (
        <p style={{ color: '#ef4444', marginBottom: 16 }}>
          ⚠ Data unavailable: {error.message}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Revenue" value={fmt$(totalRevenue)} />
        <KpiBox label="Room Nights"   value={fmtInt(totalNights)} />
        <KpiBox label="Avg ADR"       value={fmt$(avgAdr)} />
        <KpiBox label="Avg OCC"       value={fmtPct(avgOcc)} />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
