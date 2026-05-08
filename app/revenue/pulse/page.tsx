// app/revenue/pulse/page.tsx
// Marathon #195 child — Revenue · Pulse
// Data source: public.reservations (Cloudbeds sync table)
// Falls back gracefully to '—' when data is absent.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── types ────────────────────────────────────────────────────────────────────

interface DailyRow {
  stay_date: string;
  rooms_sold: number;
  rooms_available: number;
  room_revenue: number;
  adr: number;
  revpar: number;
  occupancy_pct: number;
}

interface KpiSummary {
  occ: string;
  adr: string;
  revpar: string;
  rooms_sold: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(1)} %`;
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `$${v.toFixed(2)}`;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return String(Math.round(v));
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function RevenuePulsePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Rolling 30-day window ending today
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Attempt to read from f_overview_kpis first (may not exist yet)
  const { data: kpiRaw } = await supabase
    .from('f_overview_kpis')
    .select('*')
    .limit(1)
    .maybeSingle();

  // Daily breakdown — attempt reservations aggregate
  const { data: dailyRaw } = await supabase
    .from('f_daily_revenue')
    .select('stay_date, rooms_sold, rooms_available, room_revenue, adr, revpar, occupancy_pct')
    .gte('stay_date', thirtyDaysAgo)
    .lte('stay_date', today)
    .order('stay_date', { ascending: false })
    .limit(30);

  const rows: DailyRow[] = (dailyRaw ?? []) as DailyRow[];

  // Build summary KPIs — prefer dedicated KPI view, else derive from daily rows
  const kpis: KpiSummary = (() => {
    if (kpiRaw) {
      return {
        occ: fmtPct(kpiRaw.occupancy_pct),
        adr: fmtUsd(kpiRaw.adr),
        revpar: fmtUsd(kpiRaw.revpar),
        rooms_sold: fmtInt(kpiRaw.rooms_sold),
      };
    }
    if (rows.length > 0) {
      const totalRooms = rows.reduce((s, r) => s + (r.rooms_sold ?? 0), 0);
      const totalRevenue = rows.reduce((s, r) => s + (r.room_revenue ?? 0), 0);
      const totalAvail = rows.reduce((s, r) => s + (r.rooms_available ?? 0), 0);
      const avgAdr = totalRooms > 0 ? totalRevenue / totalRooms : null;
      const avgRevpar = totalAvail > 0 ? totalRevenue / totalAvail : null;
      const avgOcc = totalAvail > 0 ? (totalRooms / totalAvail) * 100 : null;
      return {
        occ: fmtPct(avgOcc),
        adr: fmtUsd(avgAdr),
        revpar: fmtUsd(avgRevpar),
        rooms_sold: fmtInt(totalRooms),
      };
    }
    return { occ: '—', adr: '—', revpar: '—', rooms_sold: '—' };
  })();

  const columns = [
    { key: 'stay_date', header: 'Date' },
    { key: 'rooms_sold', header: 'Rooms Sold' },
    { key: 'rooms_available', header: 'Avail' },
    { key: 'occupancy_pct', header: 'OCC %' },
    { key: 'adr', header: 'ADR (USD)' },
    { key: 'revpar', header: 'RevPAR (USD)' },
    { key: 'room_revenue', header: 'Room Revenue' },
  ];

  // Format rows for display
  const displayRows = rows.map((r) => ({
    stay_date: r.stay_date ?? '—',
    rooms_sold: fmtInt(r.rooms_sold),
    rooms_available: fmtInt(r.rooms_available),
    occupancy_pct: fmtPct(r.occupancy_pct),
    adr: fmtUsd(r.adr),
    revpar: fmtUsd(r.revpar),
    room_revenue: fmtUsd(r.room_revenue),
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Revenue" tab="Pulse" title="Pulse" />

      {/* KPI grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Occupancy" value={kpis.occ} />
        <KpiBox label="ADR" value={kpis.adr} />
        <KpiBox label="RevPAR" value={kpis.revpar} />
        <KpiBox label="Rooms Sold" value={kpis.rooms_sold} />
      </div>

      {/* 30-day daily breakdown */}
      <section>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: 12,
            color: 'var(--color-ink, #1a1a1a)',
          }}
        >
          Daily Breakdown — last 30 days
        </h2>
        {displayRows.length === 0 ? (
          <p style={{ color: 'var(--color-muted, #6b7280)', fontSize: '0.875rem' }}>
            No revenue data available for the selected window. Ensure Cloudbeds sync
            is active and <code>f_daily_revenue</code> is populated.
          </p>
        ) : (
          <DataTable columns={columns} rows={displayRows} />
        )}
      </section>
    </main>
  );
}
