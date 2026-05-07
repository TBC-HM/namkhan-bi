// app/revenue-v2/rateplans/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface RateplanRow {
  rateplan_code?: string;
  rateplan_name?: string;
  channel?: string;
  room_nights?: number;
  revenue_usd?: number;
  adr_usd?: number;
  occupancy_pct?: number;
  cancellation_pct?: number;
  avg_los?: number;
  stay_month?: string;
  [key: string]: unknown;
}

export default async function RateplansPage() {
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

  // Aggregate KPIs from the dataset
  const totalRN = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalRev = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const avgAdr = totalRN > 0 ? totalRev / totalRN : null;
  const avgOcc =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / rows.length
      : null;

  const fmtUsd = (v: number | null) =>
    v == null ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number | null) =>
    v == null ? '—' : `${v.toFixed(1)}%`;

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Rate Plans" title="Rate Plan Performance" />

      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#991B1B',
            fontSize: 13,
          }}
        >
          ⚠️ Data load error: {error.message}
        </div>
      )}

      {/* KPI summary strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Rate Plans" value={rows.length > 0 ? String(rows.length) : '—'} />
        <KpiBox label="Total Room Nights" value={totalRN > 0 ? totalRN.toLocaleString('en-US') : '—'} />
        <KpiBox label="Total Revenue" value={fmtUsd(totalRev > 0 ? totalRev : null)} />
        <KpiBox label="Blended ADR" value={fmtUsd(avgAdr)} />
      </div>

      {/* Secondary KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Avg Occupancy" value={fmtPct(avgOcc)} />
        <KpiBox
          label="Avg Cancellation"
          value={fmtPct(
            rows.length > 0
              ? rows.reduce((s, r) => s + (r.cancellation_pct ?? 0), 0) / rows.length
              : null
          )}
        />
        <KpiBox
          label="Avg LOS"
          value={
            rows.length > 0
              ? (rows.reduce((s, r) => s + (r.avg_los ?? 0), 0) / rows.length).toFixed(1)
              : '—'
          }
        />
        <KpiBox label="Channels" value={rows.length > 0 ? String(new Set(rows.map((r) => r.channel).filter(Boolean)).size) : '—'} />
      </div>

      {/* Main table */}
      {rows.length === 0 ? (
        <div
          style={{
            background: '#F9FAFB',
            border: '1px dashed #D1D5DB',
            borderRadius: 8,
            padding: '48px 24px',
            textAlign: 'center',
            color: '#6B7280',
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No rate plan data available</p>
          <p style={{ fontSize: 13 }}>
            Ensure <code>public.v_rateplan_performance</code> is populated and accessible via service role.
          </p>
        </div>
      ) : (
        <DataTable
          columns={[
            { key: 'rateplan_code', header: 'Code' },
            { key: 'rateplan_name', header: 'Rate Plan' },
            { key: 'channel', header: 'Channel' },
            { key: 'stay_month', header: 'Stay Month' },
            { key: 'room_nights', header: 'Room Nights' },
            { key: 'adr_usd', header: 'ADR (USD)' },
            { key: 'revenue_usd', header: 'Revenue (USD)' },
            { key: 'occupancy_pct', header: 'Occ %' },
            { key: 'cancellation_pct', header: 'Cancel %' },
            { key: 'avg_los', header: 'Avg LOS' },
          ]}
          rows={rows.map((r) => ({
            ...r,
            adr_usd: r.adr_usd != null ? fmtUsd(r.adr_usd) : '—',
            revenue_usd: r.revenue_usd != null ? fmtUsd(r.revenue_usd) : '—',
            occupancy_pct: r.occupancy_pct != null ? fmtPct(r.occupancy_pct) : '—',
            cancellation_pct: r.cancellation_pct != null ? fmtPct(r.cancellation_pct) : '—',
            avg_los: r.avg_los != null ? Number(r.avg_los).toFixed(1) : '—',
            stay_month: r.stay_month ?? '—',
            rateplan_code: r.rateplan_code ?? '—',
            rateplan_name: r.rateplan_name ?? '—',
            channel: r.channel ?? '—',
          }))}
        />
      )}
    </main>
  );
}
