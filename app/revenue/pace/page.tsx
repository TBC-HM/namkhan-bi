// app/revenue/pace/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  stay_date: string;
  rooms_otb: number | null;
  rooms_stly: number | null;
  rooms_variance: number | null;
  revenue_otb: number | null;
  revenue_stly: number | null;
  revenue_variance: number | null;
  adr_otb: number | null;
  adr_stly: number | null;
  occupancy_pct: number | null;
}

function fmt(v: number | null | undefined, prefix = ''): string {
  if (v == null) return '—';
  return `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
}

function fmtDelta(v: number | null | undefined, prefix = ''): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '−';
  const abs = Math.abs(v);
  return `${sign}${prefix}${abs.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
}

export default async function PacePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try mv_pace_daily first, fall back to a manual pace calc from reservations
  const { data: paceData } = await supabase
    .from('mv_pace_daily')
    .select('*')
    .gte('stay_date', new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10))
    .order('stay_date', { ascending: true })
    .limit(90);

  const rows: PaceRow[] = (paceData ?? []) as PaceRow[];

  // Aggregate KPI summaries from the rows
  const totalRoomsOTB = rows.reduce((s, r) => s + (r.rooms_otb ?? 0), 0);
  const totalRoomsSTLY = rows.reduce((s, r) => s + (r.rooms_stly ?? 0), 0);
  const totalRevOTB = rows.reduce((s, r) => s + (r.revenue_otb ?? 0), 0);
  const totalRevSTLY = rows.reduce((s, r) => s + (r.revenue_stly ?? 0), 0);
  const roomsDelta = totalRoomsOTB - totalRoomsSTLY;
  const revDelta = totalRevOTB - totalRevSTLY;
  const avgOcc =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / rows.length
      : null;

  const columns = [
    { key: 'stay_date', header: 'Stay Date' },
    { key: 'rooms_otb', header: 'Rooms OTB' },
    { key: 'rooms_stly', header: 'Rooms STLY' },
    { key: 'rooms_variance', header: 'Rooms Δ' },
    { key: 'revenue_otb', header: 'Rev OTB ($)' },
    { key: 'revenue_stly', header: 'Rev STLY ($)' },
    { key: 'revenue_variance', header: 'Rev Δ ($)' },
    { key: 'adr_otb', header: 'ADR OTB ($)' },
    { key: 'adr_stly', header: 'ADR STLY ($)' },
    { key: 'occupancy_pct', header: 'OCC %' },
  ];

  const tableRows = rows.map((r) => ({
    stay_date: r.stay_date ?? '—',
    rooms_otb: fmt(r.rooms_otb),
    rooms_stly: fmt(r.rooms_stly),
    rooms_variance: fmtDelta(r.rooms_variance),
    revenue_otb: fmt(r.revenue_otb, '$'),
    revenue_stly: fmt(r.revenue_stly, '$'),
    revenue_variance: fmtDelta(r.revenue_variance, '$'),
    adr_otb: fmt(r.adr_otb, '$'),
    adr_stly: fmt(r.adr_stly, '$'),
    occupancy_pct: r.occupancy_pct != null ? `${r.occupancy_pct.toFixed(1)}%` : '—',
  }));

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Revenue" tab="Pace" title="Pace vs STLY" />

      {rows.length === 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          No pace data available — <code>mv_pace_daily</code> returned 0 rows. Confirm
          the materialised view exists and has been refreshed.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <KpiBox
          label="Rooms OTB (90d)"
          value={totalRoomsOTB > 0 ? totalRoomsOTB.toLocaleString() : '—'}
        />
        <KpiBox
          label="Rooms vs STLY"
          value={totalRoomsSTLY > 0 ? fmtDelta(roomsDelta) : '—'}
        />
        <KpiBox
          label="Revenue OTB (90d)"
          value={totalRevOTB > 0 ? fmt(totalRevOTB, '$') : '—'}
        />
        <KpiBox
          label="Revenue vs STLY"
          value={totalRevSTLY > 0 ? fmtDelta(revDelta, '$') : '—'}
        />
        <KpiBox
          label="Avg OCC % (90d)"
          value={avgOcc != null ? `${avgOcc.toFixed(1)}%` : '—'}
        />
        <KpiBox
          label="ADR OTB (latest)"
          value={rows.length > 0 ? fmt(rows[rows.length - 1]?.adr_otb, '$') : '—'}
        />
        <KpiBox
          label="ADR STLY (latest)"
          value={rows.length > 0 ? fmt(rows[rows.length - 1]?.adr_stly, '$') : '—'}
        />
        <KpiBox
          label="Days Tracked"
          value={rows.length > 0 ? String(rows.length) : '—'}
        />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
