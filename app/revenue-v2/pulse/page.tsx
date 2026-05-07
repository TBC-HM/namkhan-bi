/**
 * /revenue-v2/pulse — Live KPI pulse page
 * Ticket #107 slice: wire to public.v_overview_kpis
 *
 * Assumptions:
 *  - v_overview_kpis exposes: period_date, rooms_sold, adr_usd, revpar_usd,
 *    occupancy_pct, adr_stly, revpar_stly, occupancy_stly (STLY compare columns)
 *  - Server component — no client interactivity needed on this slice
 *  - USD values prefixed with $, occupancy as %, STLY delta shown as +/− pp
 *  - Em-dash rendered for any null value per brand standard
 *  - Colors via CSS vars only (var(--brass), var(--t-2xl), etc.)
 *  - KpiBox imported from canonical component path
 */

import { createClient } from '@supabase/supabase-js'
import { KpiBox } from '@/components/kpi/KpiBox'

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface OverviewKpiRow {
  period_date: string | null
  rooms_sold: number | null
  adr_usd: number | null
  revpar_usd: number | null
  occupancy_pct: number | null
  adr_stly: number | null
  revpar_stly: number | null
  occupancy_stly: number | null
  total_revenue_usd: number | null
}

function fmt(val: number | null, prefix = '', decimals = 0): string {
  if (val === null || val === undefined) return '—'
  return `${prefix}${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return `${val.toFixed(1)}%`
}

function fmtDelta(current: number | null, stly: number | null, prefix = '', decimals = 0): string {
  if (current === null || stly === null) return '—'
  const delta = current - stly
  const sign = delta >= 0 ? '+' : '−'
  return `${sign}${prefix}${Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function fmtDeltaPct(current: number | null, stly: number | null): string {
  if (current === null || stly === null) return '—'
  const delta = current - stly
  const sign = delta >= 0 ? '+' : '−'
  return `${sign}${Math.abs(delta).toFixed(1)} pp`
}

export const revalidate = 300 // ISR: refresh every 5 minutes

export default async function RevenuePulsePage() {
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabase
    .from('v_overview_kpis')
    .select('*')
    .order('period_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row: OverviewKpiRow | null = error ? null : data

  // Latest date label
  const dateLabel = row?.period_date
    ? new Date(row.period_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <main className="pulse-page">
      <header className="pulse-header">
        <h1 className="pulse-title">Revenue Pulse</h1>
        {error && (
          <p className="pulse-error" role="alert">
            ⚠ Could not load live data — showing placeholder values.
          </p>
        )}
        <p className="pulse-date">
          As of&nbsp;<time dateTime={row?.period_date ?? ''}>{dateLabel}</time>
        </p>
      </header>

      <section className="pulse-kpi-grid" aria-label="Key performance indicators">
        <KpiBox
          label="Rooms Sold"
          value={fmt(row?.rooms_sold ?? null)}
          delta={null}
          deltaLabel={null}
        />
        <KpiBox
          label="ADR"
          value={fmt(row?.adr_usd ?? null, '$', 2)}
          delta={fmtDelta(row?.adr_usd ?? null, row?.adr_stly ?? null, '$', 2)}
          deltaLabel="vs STLY"
        />
        <KpiBox
          label="RevPAR"
          value={fmt(row?.revpar_usd ?? null, '$', 2)}
          delta={fmtDelta(row?.revpar_usd ?? null, row?.revpar_stly ?? null, '$', 2)}
          deltaLabel="vs STLY"
        />
        <KpiBox
          label="Occupancy"
          value={fmtPct(row?.occupancy_pct ?? null)}
          delta={fmtDeltaPct(row?.occupancy_pct ?? null, row?.occupancy_stly ?? null)}
          deltaLabel="vs STLY"
        />
        {row?.total_revenue_usd !== undefined && (
          <KpiBox
            label="Total Revenue"
            value={fmt(row?.total_revenue_usd ?? null, '$', 0)}
            delta={null}
            deltaLabel={null}
          />
        )}
      </section>

      <style jsx>{`
        .pulse-page {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .pulse-header {
          margin-bottom: 2rem;
        }
        .pulse-title {
          font-family: var(--font-fraunces, Georgia, serif);
          font-style: italic;
          font-size: var(--t-2xl);
          letter-spacing: var(--ls-extra);
          color: var(--brass);
          margin: 0 0 0.25rem;
        }
        .pulse-date {
          font-size: var(--t-sm);
          color: var(--muted, #6b7280);
          margin: 0;
        }
        .pulse-error {
          font-size: var(--t-sm);
          color: var(--danger, #dc2626);
          margin: 0.25rem 0;
        }
        .pulse-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
        }
      `}</style>
    </main>
  )
}
