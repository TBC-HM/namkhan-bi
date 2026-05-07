'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PaceRow {
  stay_date: string
  otb_rooms: number | null
  otb_revenue: number | null
  stly_rooms: number | null
  stly_revenue: number | null
  pickup_rooms: number | null
  pickup_revenue: number | null
  occupancy_pct: number | null
  adr_usd: number | null
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—'
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function delta(otb: number | null, stly: number | null): string {
  if (otb == null || stly == null) return '—'
  const d = otb - stly
  if (d === 0) return '0'
  return d > 0 ? `+${d.toLocaleString('en-US')}` : `−${Math.abs(d).toLocaleString('en-US')}`
}

export default function PacePage() {
  const [rows, setRows] = useState<PaceRow[]>([])
  const [source, setSource] = useState<'snapshot' | 'actuals_proxy' | 'mv_pace_daily' | 'loading'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const today = new Date()
      const fromDate = today.toISOString().slice(0, 10)
      const toDate = new Date(today.getTime() + 90 * 86400_000).toISOString().slice(0, 10)

      // Step 1: try f_pace_stly_snapshot (canonical per DESIGN_NAMKHAN_BI)
      try {
        const { data: snapData, error: snapErr } = await supabase.rpc('f_pace_stly_snapshot', {
          p_from: fromDate,
          p_to: toDate,
        })

        if (!snapErr && snapData && snapData.length > 0) {
          setRows(snapData as PaceRow[])
          setSource('snapshot')
          return
        }
      } catch (_) {
        // fall through
      }

      // Step 2: fallback — mv_kpi_daily for OTB + STLY shifted by 365d
      try {
        const { data: kpiData, error: kpiErr } = await supabase
          .from('mv_kpi_daily')
          .select('stay_date, rooms_sold, revenue_usd, occupancy, adr_usd')
          .gte('stay_date', fromDate)
          .lte('stay_date', toDate)
          .order('stay_date', { ascending: true })

        if (!kpiErr && kpiData && kpiData.length > 0) {
          // build STLY map: shift OTB dates back 365d to find last-year actuals
          const stlyFrom = new Date(today.getTime() - 275 * 86400_000).toISOString().slice(0, 10)
          const stlyTo = new Date(today.getTime() - 275 * 86400_000 + 90 * 86400_000).toISOString().slice(0, 10)

          const { data: stlyData } = await supabase
            .from('mv_kpi_daily')
            .select('stay_date, rooms_sold, revenue_usd')
            .gte('stay_date', stlyFrom)
            .lte('stay_date', stlyTo)
            .order('stay_date', { ascending: true })

          const stlyMap: Record<string, { rooms_sold: number; revenue_usd: number }> = {}
          for (const r of stlyData ?? []) {
            // map STLY row to its +365d equivalent
            const shifted = new Date(new Date(r.stay_date).getTime() + 365 * 86400_000)
              .toISOString()
              .slice(0, 10)
            stlyMap[shifted] = { rooms_sold: r.rooms_sold, revenue_usd: r.revenue_usd }
          }

          const mapped: PaceRow[] = kpiData.map((r) => {
            const stly = stlyMap[r.stay_date]
            return {
              stay_date: r.stay_date,
              otb_rooms: r.rooms_sold,
              otb_revenue: r.revenue_usd,
              stly_rooms: stly?.rooms_sold ?? null,
              stly_revenue: stly?.revenue_usd ?? null,
              pickup_rooms: null,
              pickup_revenue: null,
              occupancy_pct: r.occupancy,
              adr_usd: r.adr_usd,
            }
          })

          setRows(mapped)
          setSource('actuals_proxy')
          return
        }
      } catch (_) {
        // fall through
      }

      setError('No pace data available. Check mv_kpi_daily / f_pace_stly_snapshot.')
    }

    load()
  }, [])

  const sourceLabel =
    source === 'snapshot'
      ? 'STLY source: f_pace_stly_snapshot · true on-the-books as-of-then'
      : source === 'actuals_proxy'
      ? 'STLY source: mv_kpi_daily · last-year actuals proxy (snapshot accumulating since 2026-05-03 · auto-switches once window covered)'
      : source === 'loading'
      ? 'Loading…'
      : '—'

  return (
    <main style={{ padding: '2rem', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <h1 style={{ fontSize: 'var(--t-2xl)', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: '0.5rem' }}>
        Pace — 90-Day OTB
      </h1>

      <p style={{ fontSize: '0.75rem', color: 'var(--muted, #888)', marginBottom: '1.5rem' }}>
        {sourceLabel}
      </p>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
      )}

      {source === 'loading' && !error && (
        <p style={{ color: 'var(--muted, #888)' }}>Loading pace data…</p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--brass)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>OTB Rooms</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>OTB Rev</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>STLY Rooms</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>STLY Rev</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Δ Rooms</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Δ Rev</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Occ %</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>ADR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.stay_date}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'var(--row-stripe, rgba(0,0,0,0.03))',
                    borderBottom: '1px solid var(--border, #eee)',
                  }}
                >
                  <td style={{ padding: '0.4rem 0.75rem' }}>{r.stay_date}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{fmt(r.otb_rooms)}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{fmt(r.otb_revenue, '$')}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{fmt(r.stly_rooms)}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{fmt(r.stly_revenue, '$')}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{delta(r.otb_rooms, r.stly_rooms)}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{delta(r.otb_revenue, r.stly_revenue)}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{fmtPct(r.occupancy_pct)}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>{fmt(r.adr_usd, '$')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
