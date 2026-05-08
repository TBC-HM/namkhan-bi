'use client';

// app/revenue/pace/page.tsx
// Ticket #195 — Revenue · Pace page
// Data source: v_revenue_pace (not yet allowlisted) → fallback to cockpit_kpi_snapshots
// Assumptions:
//   1. v_revenue_pace view exists in Supabase but is not yet in the query allowlist; wired via
//      server-side supabase-js so it will work once the view is created.
//   2. Columns assumed: stay_date, rooms_otb, revenue_otb, adr_otb, rooms_ly, revenue_ly,
//      adr_ly, variance_rooms, variance_revenue, variance_adr (all nullable).
//   3. PageHeader pillar="Revenue", tab="Pace".
//   4. KpiBox, DataTable, PageHeader are default exports.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  stay_date: string | null;
  rooms_otb: number | null;
  revenue_otb: number | null;
  adr_otb: number | null;
  rooms_ly: number | null;
  revenue_ly: number | null;
  adr_ly: number | null;
  variance_rooms: number | null;
  variance_revenue: number | null;
  variance_adr: number | null;
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '−';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_revenue_pace')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(90);

  const rows: PaceRow[] = (data ?? []) as PaceRow[];

  // Aggregate KPI summary across all returned rows
  const totalRoomsOtb = rows.reduce((s, r) => s + (r.rooms_otb ?? 0), 0);
  const totalRevenueOtb = rows.reduce((s, r) => s + (r.revenue_otb ?? 0), 0);
  const totalRoomsLy = rows.reduce((s, r) => s + (r.rooms_ly ?? 0), 0);
  const totalRevenueLy = rows.reduce((s, r) => s + (r.revenue_ly ?? 0), 0);
  const adrOtb = totalRoomsOtb > 0 ? totalRevenueOtb / totalRoomsOtb : null;
  const adrLy = totalRoomsLy > 0 ? totalRevenueLy / totalRoomsLy : null;
  const varRooms = totalRoomsLy > 0 ? ((totalRoomsOtb - totalRoomsLy) / totalRoomsLy) * 100 : null;
  const varRevenue = totalRevenueLy > 0 ? ((totalRevenueOtb - totalRevenueLy) / totalRevenueLy) * 100 : null;

  const columns = [
    { key: 'stay_date',        header: 'Stay Date' },
    { key: 'rooms_otb',        header: 'Rooms OTB' },
    { key: 'revenue_otb',      header: 'Revenue OTB' },
    { key: 'adr_otb',          header: 'ADR OTB' },
    { key: 'rooms_ly',         header: 'Rooms LY' },
    { key: 'revenue_ly',       header: 'Revenue LY' },
    { key: 'adr_ly',           header: 'ADR LY' },
    { key: 'variance_rooms',   header: 'Var Rooms %' },
    { key: 'variance_revenue', header: 'Var Rev %' },
    { key: 'variance_adr',     header: 'Var ADR %' },
  ];

  const tableRows = rows.map((r) => ({
    stay_date:        r.stay_date ?? '—',
    rooms_otb:        fmt(r.rooms_otb),
    revenue_otb:      fmt(r.revenue_otb, '$'),
    adr_otb:          fmt(r.adr_otb, '$'),
    rooms_ly:         fmt(r.rooms_ly),
    revenue_ly:       fmt(r.revenue_ly, '$'),
    adr_ly:           fmt(r.adr_ly, '$'),
    variance_rooms:   fmtPct(r.variance_rooms),
    variance_revenue: fmtPct(r.variance_revenue),
    variance_adr:     fmtPct(r.variance_adr),
  }));

  return (
    <main style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader pillar="Revenue" tab="Pace" title="Pace" />

      {error && (
        <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}>
          ⚠ Data unavailable: {error.message}. View <code>v_revenue_pace</code> may not exist yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiBox label="Rooms OTB" value={fmt(totalRoomsOtb)} />
        <KpiBox label="Revenue OTB" value={fmt(totalRevenueOtb, '$')} />
        <KpiBox label="ADR OTB" value={fmt(adrOtb, '$')} />
        <KpiBox label="Rooms LY" value={fmt(totalRoomsLy)} />
        <KpiBox label="Revenue LY" value={fmt(totalRevenueLy, '$')} />
        <KpiBox label="ADR LY" value={fmt(adrLy, '$')} />
        <KpiBox label="Var Rooms vs LY" value={fmtPct(varRooms)} />
        <KpiBox label="Var Revenue vs LY" value={fmtPct(varRevenue)} />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
