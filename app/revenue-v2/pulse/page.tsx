// app/revenue-v2/pulse/page.tsx
// Ticket #107 — wire /revenue-v2/pulse to live Supabase data
// Assumption: public.f_overview_kpis not yet in allowlist → using v_pl_monthly_usali
// as the nearest confirmed revenue shape. Swap .from() when f_overview_kpis is exposed.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlRow {
  month?: string | null;
  total_revenue?: number | null;
  rooms_revenue?: number | null;
  fb_revenue?: number | null;
  other_revenue?: number | null;
  total_expenses?: number | null;
  gop?: number | null;
  gop_pct?: number | null;
  occupancy_pct?: number | null;
  adr?: number | null;
  revpar?: number | null;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsd(val: number | null | undefined): string {
  if (val == null) return '—';
  const abs = Math.abs(val);
  const formatted =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 1_000
      ? `$${(abs / 1_000).toFixed(1)}k`
      : `$${abs.toFixed(0)}`;
  return val < 0 ? `−${formatted.slice(1)}` : formatted;
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—';
  const sign = val < 0 ? '−' : '';
  return `${sign}${Math.abs(val).toFixed(1)}%`;
}

function latestRow(rows: PlRow[]): PlRow {
  return rows[0] ?? {};
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RevenuePulsePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_pl_monthly_usali')
    .select(
      'month, total_revenue, rooms_revenue, fb_revenue, other_revenue, ' +
      'total_expenses, gop, gop_pct, occupancy_pct, adr, revpar'
    )
    .order('month', { ascending: false })
    .limit(12);

  if (error) {
    console.error('[RevenuePulse] Supabase error:', error.message);
  }

  const rows: PlRow[] = data ?? [];
  const latest = latestRow(rows);

  // ── KPI summary ─────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total Revenue',   value: fmtUsd(latest.total_revenue) },
    { label: 'Rooms Revenue',   value: fmtUsd(latest.rooms_revenue) },
    { label: 'F&B Revenue',     value: fmtUsd(latest.fb_revenue) },
    { label: 'GOP',             value: fmtUsd(latest.gop) },
    { label: 'GOP %',           value: fmtPct(latest.gop_pct) },
    { label: 'Occupancy',       value: fmtPct(latest.occupancy_pct) },
    { label: 'ADR',             value: latest.adr != null ? `$${latest.adr.toFixed(0)}` : '—' },
    { label: 'RevPAR',          value: latest.revpar != null ? `$${latest.revpar.toFixed(0)}` : '—' },
  ];

  // ── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    { key: 'month',          header: 'Month' },
    { key: 'total_revenue',  header: 'Total Revenue' },
    { key: 'rooms_revenue',  header: 'Rooms' },
    { key: 'fb_revenue',     header: 'F&B' },
    { key: 'gop',            header: 'GOP' },
    { key: 'gop_pct',        header: 'GOP %' },
    { key: 'occupancy_pct',  header: 'OCC %' },
    { key: 'adr',            header: 'ADR' },
    { key: 'revpar',         header: 'RevPAR' },
  ];

  // Format rows for display
  const displayRows = rows.map((r) => ({
    month:         r.month ?? '—',
    total_revenue: fmtUsd(r.total_revenue),
    rooms_revenue: fmtUsd(r.rooms_revenue),
    fb_revenue:    fmtUsd(r.fb_revenue),
    gop:           fmtUsd(r.gop),
    gop_pct:       fmtPct(r.gop_pct),
    occupancy_pct: fmtPct(r.occupancy_pct),
    adr:           r.adr != null ? `$${r.adr.toFixed(0)}` : '—',
    revpar:        r.revpar != null ? `$${r.revpar.toFixed(0)}` : '—',
  }));

  return (
    <main style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader pillar="Revenue" tab="Pulse" title="Revenue Pulse" />

      {/* KPI tile grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {kpis.map((k) => (
          <KpiBox key={k.label} label={k.label} value={k.value} />
        ))}
      </div>

      {/* Monthly trend table — last 12 months */}
      <section>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#6B7280',
            marginBottom: 12,
          }}
        >
          Monthly Trend — Last 12 Months
        </h2>
        <DataTable columns={columns} rows={displayRows} />
      </section>

      {error && (
        <p
          role="alert"
          style={{ marginTop: 24, color: '#EF4444', fontSize: '12px' }}
        >
          Data source error — showing cached or empty state. ({error.message})
        </p>
      )}
    </main>
  );
}
