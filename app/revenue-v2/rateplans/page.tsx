/**
 * /revenue-v2/rateplans
 * Wired to: public.v_rateplan_performance
 * Ticket: slice of #107
 *
 * ASSUMPTIONS (see PR description for full list):
 * - v_rateplan_performance columns: rateplan_code, rateplan_name, room_nights, revenue_usd,
 *   adr_usd, occupancy_pct, revenue_share_pct, month (YYYY-MM)
 * - Server component (no client-side interactivity needed)
 * - Supabase service role used for server fetch
 * - Sorted by revenue_usd DESC
 * - v_rateplan_performance not yet in query allowlist → fetched directly via supabase-js
 */

import { createClient } from '@supabase/supabase-js'
import { KpiBox } from '@/components/kpi/KpiBox'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RateplanRow {
  rateplan_code: string
  rateplan_name: string
  room_nights: number | null
  revenue_usd: number | null
  adr_usd: number | null
  occupancy_pct: number | null
  revenue_share_pct: number | null
  month: string | null
}

function fmt(n: number | null, prefix = ''): string {
  if (n == null) return '—'
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

export const revalidate = 300 // 5 min ISR

export default async function RateplansPage() {
  const { data, error } = await supabase
    .from('v_rateplan_performance')
    .select('*')
    .order('revenue_usd', { ascending: false })
    .limit(100)

  const rows: RateplanRow[] = data ?? []

  // Aggregate KPIs from returned rows
  const totalRevenue = rows.reduce((sum, r) => sum + (r.revenue_usd ?? 0), 0)
  const totalRoomNights = rows.reduce((sum, r) => sum + (r.room_nights ?? 0), 0)
  const avgAdr =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + (r.adr_usd ?? 0), 0) / rows.filter(r => r.adr_usd != null).length
      : null

  return (
    <main style={{ padding: 'var(--space-6)' }}>
      <h1
        style={{
          fontSize: 'var(--t-2xl)',
          letterSpacing: 'var(--ls-extra)',
          fontWeight: 600,
          marginBottom: 'var(--space-4)',
          color: 'var(--brass)',
        }}
      >
        Rate Plan Performance
      </h1>

      {error && (
        <p style={{ color: 'var(--red-alert)', marginBottom: 'var(--space-4)' }}>
          ⚠ Data unavailable: {error.message}
        </p>
      )}

      {/* KPI Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <KpiBox label="Total Revenue" value={fmt(totalRevenue, '$')} />
        <KpiBox label="Total Room Nights" value={fmt(totalRoomNights)} />
        <KpiBox label="Avg ADR" value={fmt(avgAdr, '$')} />
        <KpiBox label="Rate Plans" value={String(rows.length)} />
      </div>

      {/* Rate Plans Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--t-sm)',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--brass)',
                textAlign: 'left',
                color: 'var(--brass)',
                letterSpacing: 'var(--ls-extra)',
              }}
            >
              <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Code</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Rate Plan</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>Room Nights</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>Revenue (USD)</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>ADR</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>Occ %</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>Rev Share</th>
              <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Month</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  No data available
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr
                key={`${row.rateplan_code}-${row.month ?? i}`}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: i % 2 === 0 ? 'transparent' : 'var(--row-alt)',
                }}
              >
                <td
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontFamily: 'monospace',
                    color: 'var(--brass)',
                  }}
                >
                  {row.rateplan_code ?? '—'}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                  {row.rateplan_name ?? '—'}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                  {fmt(row.room_nights)}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                  {fmt(row.revenue_usd, '$')}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                  {fmt(row.adr_usd, '$')}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                  {fmtPct(row.occupancy_pct)}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                  {fmtPct(row.revenue_share_pct)}
                </td>
                <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                  {row.month ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        style={{
          marginTop: 'var(--space-4)',
          fontSize: 'var(--t-xs)',
          color: 'var(--muted)',
        }}
      >
        Source: public.v_rateplan_performance · Refreshes every 5 min
      </p>
    </main>
  )
}
