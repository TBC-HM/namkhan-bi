import { createClient } from '@supabase/supabase-js'
import { KpiBox } from '@/components/kpi/KpiBox'

// ── Types ────────────────────────────────────────────────────────────────────
interface ParityRow {
  observation_date: string        // YYYY-MM-DD
  platform: string                // e.g. "Booking.com", "Expedia"
  room_type: string               // e.g. "Deluxe River View"
  our_rate_usd: number | null
  comp_rate_usd: number | null
  delta_pct: number | null        // positive = we are more expensive
  parity_status: string | null    // e.g. "parity", "above", "below"
}

// ── Data fetch (server component) ────────────────────────────────────────────
async function fetchParity(): Promise<ParityRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('v_parity_observations_top')
    .select('*')
    .order('observation_date', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[parity] fetch error:', error.message)
    return []
  }
  return (data ?? []) as ParityRow[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(v: number | null): string {
  if (v == null) return '—'
  return '$' + v.toFixed(2)
}

function fmtDelta(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v).toFixed(1)
  return v >= 0 ? `+${abs}%` : `\u22121${abs.slice(1)}%`
}

function statusColor(s: string | null): string {
  if (s === 'above') return 'var(--color-danger, #c0392b)'
  if (s === 'below') return 'var(--color-warning, #e67e22)'
  return 'var(--color-ok, #27ae60)'
}

// ── KPI summaries ─────────────────────────────────────────────────────────────
function buildKpis(rows: ParityRow[]) {
  const total = rows.length
  const above = rows.filter(r => r.parity_status === 'above').length
  const below = rows.filter(r => r.parity_status === 'below').length
  const inParity = rows.filter(r => r.parity_status === 'parity').length
  const avgDelta =
    total > 0
      ? rows.reduce((s, r) => s + (r.delta_pct ?? 0), 0) / total
      : null
  return { total, above, below, inParity, avgDelta }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ParityPage() {
  const rows = await fetchParity()
  const { total, above, below, inParity, avgDelta } = buildKpis(rows)

  return (
    <main style={{ padding: '2rem', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <h1
        style={{
          fontSize: 'var(--t-2xl, 1.5rem)',
          letterSpacing: 'var(--ls-extra, 0.04em)',
          color: 'var(--brass, #b8952a)',
          marginBottom: '1.5rem',
        }}
      >
        Rate Parity Monitor
      </h1>

      {/* ── KPI row ── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <KpiBox label="Total Observations" value={String(total)} />
        <KpiBox label="In Parity" value={String(inParity)} />
        <KpiBox
          label="Above Parity"
          value={String(above)}
          accent={above > 0 ? 'danger' : undefined}
        />
        <KpiBox
          label="Below Parity"
          value={String(below)}
          accent={below > 0 ? 'warning' : undefined}
        />
        <KpiBox
          label="Avg Δ%"
          value={avgDelta != null ? fmtDelta(avgDelta) : '—'}
        />
      </section>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #888)' }}>
          No parity data available — view <code>v_parity_observations_top</code>{' '}
          returned 0 rows or is pending allowlist addition.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--t-sm, 0.875rem)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--brass, #b8952a)',
                  textAlign: 'left',
                  color: 'var(--brass, #b8952a)',
                  letterSpacing: 'var(--ls-extra, 0.04em)',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Platform</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Room Type</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                  Our Rate
                </th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                  Comp Rate
                </th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                  Δ%
                </th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border-subtle, #2a2a2a)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--row-alt, rgba(255,255,255,0.02))',
                  }}
                >
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {r.observation_date ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {r.platform ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {r.room_type ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmtUSD(r.our_rate_usd)}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                    {fmtUSD(r.comp_rate_usd)}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 0.75rem',
                      textAlign: 'right',
                      color: statusColor(r.parity_status),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmtDelta(r.delta_pct)}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: 'var(--t-xs, 0.75rem)',
                        background: statusColor(r.parity_status) + '22',
                        color: statusColor(r.parity_status),
                        textTransform: 'capitalize',
                      }}
                    >
                      {r.parity_status ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p
        style={{
          marginTop: '1.5rem',
          fontSize: 'var(--t-xs, 0.75rem)',
          color: 'var(--text-muted, #888)',
        }}
      >
        Source: <code>public.v_parity_observations_top</code> · refreshed on
        each page load
      </p>
    </main>
  )
}
