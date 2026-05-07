// app/revenue-v2/rateplans/page.tsx
// Wired to public.v_rateplan_performance — ticket #107 slice
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

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

const fmtUsd = (v: number | null | undefined): string =>
  v == null ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const fmtPct = (v: number | null | undefined): string =>
  v == null ? '—' : `${Number(v).toFixed(1)}%`;

const fmtNum = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('en-US');

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

  const totalRN = rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalRev = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const blendedAdr = totalRN > 0 ? totalRev / totalRN : null;
  const avgOcc =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / rows.length
      : null;
  const uniqueChannels = new Set(rows.map((r) => r.channel).filter(Boolean)).size;

  const tableColumns = [
    { key: 'rateplan_code', header: 'Code' },
    { key: 'rateplan_name', header: 'Rate Plan' },
    { key: 'channel', header: 'Channel' },
    { key: 'stay_month', header: 'Month' },
    { key: 'room_nights', header: 'Room Nights' },
    { key: 'revenue_usd', header: 'Revenue' },
    { key: 'adr_usd', header: 'ADR' },
    { key: 'occupancy_pct', header: 'OCC %' },
    { key: 'cancellation_pct', header: 'CXL %' },
    { key: 'avg_los', header: 'Avg LOS' },
  ];

  const tableRows = rows.map((r) => ({
    rateplan_code: r.rateplan_code ?? '—',
    rateplan_name: r.rateplan_name ?? '—',
    channel: r.channel ?? '—',
    stay_month: r.stay_month ?? '—',
    room_nights: fmtNum(r.room_nights),
    revenue_usd: fmtUsd(r.revenue_usd),
    adr_usd: fmtUsd(r.adr_usd),
    occupancy_pct: fmtPct(r.occupancy_pct),
    cancellation_pct: fmtPct(r.cancellation_pct),
    avg_los: r.avg_los != null ? Number(r.avg_los).toFixed(1) : '—',
  }));

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Rate Plans" title="Rate Plan Performance" />

      {error && (
        <div
          style={{
            background: 'var(--color-error, #fee2e2)',
            border: '1px solid var(--color-error-border, #fca5a5)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            color: 'var(--color-error-text, #991b1b)',
          }}
        >
          ⚠️ Supabase error: {error.message}
        </div>
      )}

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Rate Plans" value={rows.length > 0 ? String(rows.length) : '—'} />
        <KpiBox label="Total Room Nights" value={totalRN > 0 ? fmtNum(totalRN) : '—'} />
        <KpiBox label="Total Revenue" value={totalRev > 0 ? fmtUsd(totalRev) : '—'} />
        <KpiBox label="Blended ADR" value={fmtUsd(blendedAdr)} />
        <KpiBox label="Avg OCC %" value={fmtPct(avgOcc)} />
        <KpiBox label="Channels" value={uniqueChannels > 0 ? String(uniqueChannels) : '—'} />
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--color-muted, #6b7280)', marginTop: 32, textAlign: 'center' }}>
          No rate plan data available.
          {!error && (
            <span>
              {' '}
              View public.v_rateplan_performance returned 0 rows — ensure ETL has run.
            </span>
          )}
        </p>
      ) : (
        <DataTable columns={tableColumns} rows={tableRows} />
      )}
    </main>
  );
}
