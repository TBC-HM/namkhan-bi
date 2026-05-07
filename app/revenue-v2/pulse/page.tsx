// app/revenue-v2/pulse/page.tsx
// Ticket #107 / fix #171 — PBS verification pass
// Wired to public.v_overview_kpis (confirmed allowlisted canonical view).
// Falls back gracefully to em-dash for any null column.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ── Types ────────────────────────────────────────────────────────────────────
interface KpiRow {
  metric_date?: string | null;
  occupancy_pct?: number | null;
  adr?: number | null;
  revpar?: number | null;
  rooms_sold?: number | null;
  rooms_revenue?: number | null;
  occ_delta_stly_pp?: number | null;
  adr_delta_stly_pct?: number | null;
  revpar_delta_stly_pct?: number | null;
  [key: string]: unknown;
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}%`;
}
function fmtUsd(v: number | null | undefined): string {
  if (v == null) return '—';
  const abs = Math.abs(v);
  const s =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `$${(abs / 1_000).toFixed(1)}k`
      : `$${abs.toFixed(0)}`;
  return v < 0 ? `−${s.slice(1)}` : s;
}
function fmtDelta(v: number | null | undefined, unit: 'pp' | 'pct' = 'pct'): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '−';
  const abs = Math.abs(v).toFixed(1);
  return unit === 'pp' ? `${sign}${abs} pp` : `${sign}${abs}%`;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function PulsePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: v_overview_kpis — confirmed allowlisted view (KB #321)
  const { data: rawRows, error } = await supabase
    .from('v_overview_kpis')
    .select('*')
    .order('metric_date', { ascending: false })
    .limit(30);

  const rows: KpiRow[] = rawRows ?? [];
  const today: KpiRow = rows[0] ?? {};

  // Verification probe — logged server-side so PBS can confirm live data arrives
  console.log(
    `[pulse/page] v_overview_kpis returned ${rows.length} rows. ` +
    `Today row: metric_date=${today.metric_date ?? 'null'}, ` +
    `occ=${today.occupancy_pct ?? 'null'}, adr=${today.adr ?? 'null'}, revpar=${today.revpar ?? 'null'}. ` +
    (error ? `ERROR: ${error.message}` : 'no error.')
  );

  // Table columns
  const columns = [
    { key: 'metric_date', header: 'Date' },
    { key: 'occupancy_pct_fmt', header: 'OCC %' },
    { key: 'adr_fmt', header: 'ADR' },
    { key: 'revpar_fmt', header: 'RevPAR' },
    { key: 'rooms_sold', header: 'Rooms Sold' },
    { key: 'rooms_revenue_fmt', header: 'Rooms Rev' },
    { key: 'occ_delta', header: 'OCC vs STLY' },
    { key: 'adr_delta', header: 'ADR vs STLY' },
    { key: 'revpar_delta', header: 'RevPAR vs STLY' },
  ];

  const tableRows = rows.map((r) => ({
    metric_date: r.metric_date ?? '—',
    occupancy_pct_fmt: fmtPct(r.occupancy_pct),
    adr_fmt: fmtUsd(r.adr),
    revpar_fmt: fmtUsd(r.revpar),
    rooms_sold: r.rooms_sold ?? '—',
    rooms_revenue_fmt: fmtUsd(r.rooms_revenue),
    occ_delta: fmtDelta(r.occ_delta_stly_pp, 'pp'),
    adr_delta: fmtDelta(r.adr_delta_stly_pct, 'pct'),
    revpar_delta: fmtDelta(r.revpar_delta_stly_pct, 'pct'),
  }));

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Pulse" title="Daily Pulse" />

      {/* Live data confirmation banner */}
      <div
        style={{
          marginBottom: 16,
          padding: '8px 12px',
          borderRadius: 6,
          background: rows.length > 0 ? '#14532d22' : '#7f1d1d22',
          border: `1px solid ${rows.length > 0 ? '#16a34a' : '#dc2626'}`,
          color: rows.length > 0 ? '#16a34a' : '#dc2626',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {rows.length > 0
          ? `✓ Live: ${rows.length} rows from v_overview_kpis — latest date: ${today.metric_date ?? 'unknown'}`
          : `✗ v_overview_kpis returned 0 rows${error ? ` — ${error.message}` : ''}`}
      </div>

      {/* KPI hero tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Occupancy" value={fmtPct(today.occupancy_pct)} delta={fmtDelta(today.occ_delta_stly_pp, 'pp')} />
        <KpiBox label="ADR" value={fmtUsd(today.adr)} delta={fmtDelta(today.adr_delta_stly_pct)} />
        <KpiBox label="RevPAR" value={fmtUsd(today.revpar)} delta={fmtDelta(today.revpar_delta_stly_pct)} />
        <KpiBox label="Rooms Sold" value={today.rooms_sold != null ? String(today.rooms_sold) : '—'} />
        <KpiBox label="Rooms Revenue" value={fmtUsd(today.rooms_revenue)} />
      </div>

      {/* Trend table */}
      <h2 style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.08em', marginBottom: 12 }}>
        DAILY TREND — LAST 30 DAYS
      </h2>
      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
