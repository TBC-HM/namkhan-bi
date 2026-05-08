// app/revenue/rateplans/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface RatePlanRow {
  rate_plan_name?: string;
  rate_plan_code?: string;
  channel?: string;
  segment?: string;
  room_nights?: number;
  total_revenue_usd?: number;
  adr_usd?: number;
  occupancy_pct?: number;
  cancellation_rate_pct?: number;
  avg_lead_days?: number;
  avg_los?: number;
  [key: string]: unknown;
}

export default async function RatePlansPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_rateplan_performance')
    .select('*')
    .order('total_revenue_usd', { ascending: false })
    .limit(100);

  const rows: RatePlanRow[] = data ?? [];

  // Aggregate KPIs from rows
  const totalRevenue = rows.reduce((sum, r) => sum + (r.total_revenue_usd ?? 0), 0);
  const totalRoomNights = rows.reduce((sum, r) => sum + (r.room_nights ?? 0), 0);
  const blendedAdr =
    totalRoomNights > 0
      ? totalRevenue / totalRoomNights
      : null;
  const avgOcc =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.occupancy_pct ?? 0), 0) / rows.length
      : null;
  const avgCancellation =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.cancellation_rate_pct ?? 0), 0) / rows.length
      : null;

  const fmt = (n: number | null, prefix = '', decimals = 1) =>
    n !== null ? `${prefix}${n.toFixed(decimals)}` : '—';

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Rate Plans" title="Rate Plans" />

      {error && (
        <p
          style={{
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            padding: '8px 14px',
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          ⚠ Data load error: {error.message} — displaying cached / empty state.
        </p>
      )}

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiBox
          label="Total Revenue"
          value={fmt(totalRevenue, '$', 0)}
          subLabel="All rate plans"
        />
        <KpiBox
          label="Room Nights"
          value={totalRoomNights > 0 ? totalRoomNights.toLocaleString() : '—'}
          subLabel="Booked"
        />
        <KpiBox
          label="Blended ADR"
          value={fmt(blendedAdr, '$')}
          subLabel="USD / night"
        />
        <KpiBox
          label="Avg Occupancy"
          value={avgOcc !== null ? `${fmt(avgOcc)}%` : '—'}
          subLabel="Across plans"
        />
        <KpiBox
          label="Avg Cancellation"
          value={avgCancellation !== null ? `${fmt(avgCancellation)}%` : '—'}
          subLabel="Rate"
        />
      </div>

      {/* Main table */}
      <DataTable
        columns={[
          { key: 'rate_plan_name', header: 'Rate Plan' },
          { key: 'rate_plan_code', header: 'Code' },
          { key: 'channel', header: 'Channel' },
          { key: 'segment', header: 'Segment' },
          { key: 'room_nights', header: 'Room Nights' },
          { key: 'total_revenue_usd', header: 'Revenue (USD)' },
          { key: 'adr_usd', header: 'ADR (USD)' },
          { key: 'occupancy_pct', header: 'OCC %' },
          { key: 'cancellation_rate_pct', header: 'Cancel %' },
          { key: 'avg_lead_days', header: 'Lead Days' },
          { key: 'avg_los', header: 'Avg LOS' },
        ]}
        rows={rows.map((r) => ({
          rate_plan_name: r.rate_plan_name ?? '—',
          rate_plan_code: r.rate_plan_code ?? '—',
          channel: r.channel ?? '—',
          segment: r.segment ?? '—',
          room_nights: r.room_nights != null ? r.room_nights.toLocaleString() : '—',
          total_revenue_usd:
            r.total_revenue_usd != null
              ? `$${r.total_revenue_usd.toFixed(2)}`
              : '—',
          adr_usd:
            r.adr_usd != null ? `$${r.adr_usd.toFixed(2)}` : '—',
          occupancy_pct:
            r.occupancy_pct != null ? `${r.occupancy_pct.toFixed(1)}%` : '—',
          cancellation_rate_pct:
            r.cancellation_rate_pct != null
              ? `${r.cancellation_rate_pct.toFixed(1)}%`
              : '—',
          avg_lead_days:
            r.avg_lead_days != null ? r.avg_lead_days.toFixed(1) : '—',
          avg_los: r.avg_los != null ? r.avg_los.toFixed(1) : '—',
        }))}
      />

      {rows.length === 0 && !error && (
        <p
          style={{
            textAlign: 'center',
            color: '#6b7280',
            marginTop: 40,
            fontSize: 14,
          }}
        >
          No rate plan data available. Ensure <code>v_rateplan_performance</code> is
          populated in Supabase.
        </p>
      )}
    </main>
  );
}
