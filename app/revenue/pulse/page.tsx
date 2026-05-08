// app/revenue/pulse/page.tsx
// Marathon #195 — Revenue · Pulse
// Server component — reads live revenue schema tables via service role.
// v_overview_kpis is not in the PostgREST schema cache; querying revenue tables directly.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaceRow {
  stay_month: string;
  rn_now: number | null;
  rn_ly: number | null;
  rn_delta_pct: number | null;
  adr_now: number | null;
  adr_ly: number | null;
  adr_delta_pct: number | null;
  rev_now: number | null;
  rev_ly: number | null;
  rev_delta_pct: number | null;
}

interface KpiSummary {
  occ_pct: number | null;
  adr: number | null;
  revpar: number | null;
  rev_total: number | null;
  rn_total: number | null;
  as_of_date: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number | null | undefined, prefix = '', decimals = 1): string {
  if (value == null) return '—';
  return `${prefix}${value.toFixed(decimals)}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function fmtCcy(value: number | null | undefined, symbol = '$'): string {
  if (value == null) return '—';
  return `${symbol}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function deltaColor(value: number | null | undefined): string {
  if (value == null) return 'inherit';
  return value >= 0 ? 'var(--color-good, #16a34a)' : 'var(--color-bad, #dc2626)';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RevenuePulsePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Pace by stay-month (revenue.bdc_pace_monthly is BDC-specific;
  //    attempt a generic pace view first, fall back to BDC pace as proxy)
  const { data: paceRaw } = await supabase
    .from('bdc_pace_monthly')
    .select('stay_month, rn_now, rn_ly, rn_delta_pct, adr_now, adr_ly, adr_delta_pct, rev_now, rev_ly, rev_delta_pct')
    .order('stay_month', { ascending: true })
    .limit(12);

  const paceRows: PaceRow[] = (paceRaw ?? []) as PaceRow[];

  // 2. KPI header — derive from latest pace row as a lightweight proxy
  //    (v_overview_kpis not in schema cache; dedicated KPI view to be wired when available)
  const latestPace = paceRows[paceRows.length - 1] ?? null;

  const kpi: KpiSummary = {
    occ_pct: null,           // OCC requires rooms-available denominator — not in pace table
    adr: latestPace?.adr_now ?? null,
    revpar: null,            // RevPAR = ADR × OCC — needs rooms-available
    rev_total: latestPace?.rev_now ?? null,
    rn_total: latestPace?.rn_now ?? null,
    as_of_date: latestPace?.stay_month ?? null,
  };

  // 3. Pace table columns
  const paceColumns = [
    { key: 'stay_month',     header: 'Stay Month' },
    { key: 'rn_now',         header: 'RN Now' },
    { key: 'rn_ly',          header: 'RN LY' },
    { key: 'rn_delta_pct',   header: 'RN Δ%' },
    { key: 'adr_now',        header: 'ADR Now' },
    { key: 'adr_ly',         header: 'ADR LY' },
    { key: 'adr_delta_pct',  header: 'ADR Δ%' },
    { key: 'rev_now',        header: 'Rev Now' },
    { key: 'rev_ly',         header: 'Rev LY' },
    { key: 'rev_delta_pct',  header: 'Rev Δ%' },
  ];

  // Render-safe rows with formatted values for DataTable
  const paceDisplayRows = paceRows.map((r) => ({
    stay_month:    r.stay_month ?? '—',
    rn_now:        r.rn_now    != null ? String(r.rn_now)  : '—',
    rn_ly:         r.rn_ly     != null ? String(r.rn_ly)   : '—',
    rn_delta_pct:  fmtPct(r.rn_delta_pct),
    adr_now:       fmt(r.adr_now, '$'),
    adr_ly:        fmt(r.adr_ly,  '$'),
    adr_delta_pct: fmtPct(r.adr_delta_pct),
    rev_now:       fmtCcy(r.rev_now),
    rev_ly:        fmtCcy(r.rev_ly),
    rev_delta_pct: fmtPct(r.rev_delta_pct),
  }));

  return (
    <main style={{ padding: '0 24px 40px' }}>
      <PageHeader pillar="Revenue" tab="Pulse" title="Revenue Pulse" />

      {/* ── KPI tiles ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="OCC %"
          value={kpi.occ_pct != null ? `${kpi.occ_pct.toFixed(1)}%` : '—'}
          subLabel="Occupancy"
        />
        <KpiBox
          label="ADR"
          value={fmt(kpi.adr, '$')}
          subLabel="Avg Daily Rate"
        />
        <KpiBox
          label="RevPAR"
          value={fmt(kpi.revpar, '$')}
          subLabel="Rev per Available Room"
        />
        <KpiBox
          label="Total Revenue"
          value={fmtCcy(kpi.rev_total)}
          subLabel={kpi.as_of_date ?? 'Latest month'}
        />
        <KpiBox
          label="Room Nights"
          value={kpi.rn_total != null ? String(kpi.rn_total) : '—'}
          subLabel="RN sold"
        />
      </div>

      {/* ── Pace vs LY notice ─────────────────────────────────────────── */}
      {paceRows.length === 0 && (
        <p
          style={{
            color: 'var(--color-muted, #6b7280)',
            fontStyle: 'italic',
            marginBottom: 24,
          }}
        >
          No pace data available yet. Upload monthly pace exports or wire{' '}
          <code>v_overview_kpis</code> to populate this view.
        </p>
      )}

      {/* ── Pace by stay-month table ───────────────────────────────────── */}
      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 12,
            color: 'var(--color-heading, #111827)',
          }}
        >
          Pace vs Last Year — by Stay Month
        </h2>

        {paceRows.length > 0 ? (
          <>
            <DataTable columns={paceColumns} rows={paceDisplayRows} />

            {/* Delta legend */}
            <div
              style={{
                display: 'flex',
                gap: 20,
                marginTop: 12,
                fontSize: 12,
                color: 'var(--color-muted, #6b7280)',
              }}
            >
              <span style={{ color: deltaColor(1) }}>▲ positive vs LY</span>
              <span style={{ color: deltaColor(-1) }}>▼ negative vs LY</span>
              <span>— data unavailable</span>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--color-muted, #6b7280)', fontStyle: 'italic' }}>
            No rows to display.
          </p>
        )}
      </section>

      {/* ── Data lineage footer ────────────────────────────────────────── */}
      <footer
        style={{
          marginTop: 40,
          fontSize: 11,
          color: 'var(--color-muted, #6b7280)',
          borderTop: '1px solid var(--color-border, #e5e7eb)',
          paddingTop: 12,
        }}
      >
        <strong>Data sources:</strong> revenue.bdc_pace_monthly (BDC Extranet export, latest snapshot).
        OCC % and RevPAR tiles require <code>v_overview_kpis</code> to be wired into the PostgREST
        schema cache — currently not available; tiles show — until resolved.
        Pace Δ% = (now − LY) / |LY| × 100.
      </footer>
    </main>
  );
}
