// app/revenue-v2/pace/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  stay_date: string;
  rooms_otb: number | null;
  adr_otb: number | null;
  rev_otb: number | null;
  rooms_stly: number | null;
  adr_stly: number | null;
  rev_stly: number | null;
  pace_rooms: number | null;
  pace_rev: number | null;
  occupancy_pct: number | null;
}

interface SnapshotRow {
  stay_date: string;
  rooms_otb: number | null;
  adr_otb: number | null;
  rev_otb: number | null;
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const formatted = `${(n * 100).toFixed(1)}%`;
  return n < 0 ? `−${formatted.replace('-', '')}` : formatted;
}

function fmtPace(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 0) return `+${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `−${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: mv_pace_daily
  const { data: paceData } = await supabase
    .from('mv_pace_daily')
    .select('*')
    .gte('stay_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .lte('stay_date', new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10))
    .order('stay_date', { ascending: true })
    .limit(100);

  // STLY fallback: try f_pace_stly_snapshot, else mv_kpi_daily shifted -365d
  let stlySource: 'snapshot' | 'actuals_proxy' = 'actuals_proxy';
  let stlyRows: SnapshotRow[] = [];

  const today = new Date();
  const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const toDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const { data: snapData } = await supabase
    .rpc('f_pace_stly_snapshot', { p_from: fromDate, p_to: toDate });

  if (snapData && snapData.length > 0) {
    stlySource = 'snapshot';
    stlyRows = snapData as SnapshotRow[];
  } else {
    // Fallback: mv_kpi_daily shifted back 365 days
    const fromStly = new Date(today.getTime() - (365 + 7) * 86400000).toISOString().slice(0, 10);
    const toStly = new Date(today.getTime() - (365 - 90) * 86400000).toISOString().slice(0, 10);
    const { data: kpiData } = await supabase
      .from('mv_kpi_daily')
      .select('stay_date, rooms_sold, adr, revenue')
      .gte('stay_date', fromStly)
      .lte('stay_date', toStly)
      .order('stay_date', { ascending: true })
      .limit(100);
    stlyRows = (kpiData ?? []).map((r: { stay_date: string; rooms_sold: number | null; adr: number | null; revenue: number | null }) => ({
      stay_date: r.stay_date,
      rooms_otb: r.rooms_sold,
      adr_otb: r.adr,
      rev_otb: r.revenue,
    }));
  }

  const rows: PaceRow[] = (paceData ?? []).map((r: PaceRow) => r);

  // Aggregate KPIs from current window
  const totalRoomsOTB = rows.reduce((s, r) => s + (r.rooms_otb ?? 0), 0);
  const totalRevOTB = rows.reduce((s, r) => s + (r.rev_otb ?? 0), 0);
  const totalPaceRooms = rows.reduce((s, r) => s + (r.pace_rooms ?? 0), 0);
  const totalPaceRev = rows.reduce((s, r) => s + (r.pace_rev ?? 0), 0);
  const avgAdr = totalRoomsOTB > 0 ? totalRevOTB / totalRoomsOTB : null;

  const columns = [
    { key: 'stay_date', header: 'Date' },
    { key: 'rooms_otb', header: 'Rooms OTB' },
    { key: 'adr_otb', header: 'ADR OTB' },
    { key: 'rev_otb', header: 'Rev OTB' },
    { key: 'rooms_stly', header: 'Rooms STLY' },
    { key: 'adr_stly', header: 'ADR STLY' },
    { key: 'rev_stly', header: 'Rev STLY' },
    { key: 'pace_rooms', header: 'Pace Rooms' },
    { key: 'pace_rev', header: 'Pace Rev' },
    { key: 'occupancy_pct', header: 'OCC %' },
  ];

  const displayRows = rows.map((r) => ({
    stay_date: r.stay_date ?? '—',
    rooms_otb: fmt(r.rooms_otb),
    adr_otb: fmt(r.adr_otb, '$'),
    rev_otb: fmt(r.rev_otb, '$'),
    rooms_stly: fmt(r.rooms_stly),
    adr_stly: fmt(r.adr_stly, '$'),
    rev_stly: fmt(r.rev_stly, '$'),
    pace_rooms: fmtPace(r.pace_rooms),
    pace_rev: fmtPace(r.pace_rev),
    occupancy_pct: fmtPct(r.occupancy_pct),
  }));

  const stlyBannerText =
    stlySource === 'snapshot'
      ? 'STLY source: f_pace_stly_snapshot · true OTB-as-of-then'
      : 'STLY source: mv_kpi_daily · last-year actuals proxy (snapshot table accumulating since 2026-05-03 · auto-switches once data covers the lead-time window)';

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Pace" title="Pace" />

      {/* STLY source banner */}
      <div
        style={{
          background: stlySource === 'snapshot' ? '#e6f4ea' : '#fff8e1',
          border: `1px solid ${stlySource === 'snapshot' ? '#34a853' : '#f9a825'}`,
          borderRadius: 6,
          padding: '8px 14px',
          fontSize: 13,
          color: '#333',
          marginBottom: 20,
        }}
      >
        ℹ️ {stlyBannerText}
      </div>

      {/* KPI summary tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiBox label="Rooms OTB (90d)" value={fmt(totalRoomsOTB)} />
        <KpiBox label="Rev OTB (90d)" value={fmt(totalRevOTB, '$')} />
        <KpiBox label="Avg ADR OTB" value={fmt(avgAdr, '$')} />
        <KpiBox label="Pace vs STLY (rooms)" value={fmtPace(totalPaceRooms)} />
      </div>

      {/* Daily pace table */}
      <DataTable columns={columns} rows={displayRows} />

      {rows.length === 0 && (
        <p style={{ color: '#888', marginTop: 16, fontSize: 14 }}>
          No pace data available for this window. Check that mv_pace_daily is populated and refreshing correctly.
        </p>
      )}
    </main>
  );
}
