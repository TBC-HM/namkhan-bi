import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarLadderRow {
  stay_date?: string | null
  room_type?: string | null
  bar_level?: string | null
  bar_rate_usd?: number | null
  bar_rate_lak?: number | null
  occ_pct?: number | null
  rooms_available?: number | null
  rooms_sold?: number | null
  channel?: string | null
  notes?: string | null
  [key: string]: unknown
}

// ─── Data fetcher (server-side, service role) ─────────────────────────────────

async function fetchBarLadder(): Promise<BarLadderRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('v_bar_ladder')
    .select('*')
    .order('stay_date', { ascending: true })
    .limit(120)

  if (error) {
    console.error('[pricing/page] v_bar_ladder error:', error.message)
    return []
  }
  return (data ?? []) as BarLadderRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  return val.slice(0, 10) // ISO YYYY-MM-DD
}

function fmtUSD(val: number | null | undefined): string {
  if (val == null) return '—'
  return val < 0
    ? `−$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtLAK(val: number | null | undefined): string {
  if (val == null) return '—'
  return val < 0
    ? `−₭${Math.abs(val).toLocaleString('en-US')}`
    : `₭${val.toLocaleString('en-US')}`
}

function fmtPct(val: number | null | undefined): string {
  if (val == null) return '—'
  return `${(val * (val <= 1 ? 100 : 1)).toFixed(1)}%`
}

function fmtInt(val: number | null | undefined): string {
  if (val == null) return '—'
  return val.toLocaleString('en-US')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PricingPage() {
  const rows = await fetchBarLadder()

  // Derive unique columns from first row (view may add/remove cols over time)
  const COLUMNS: { key: keyof BarLadderRow; label: string; fmt: (v: unknown) => string }[] = [
    { key: 'stay_date',       label: 'Stay Date',    fmt: (v) => fmtDate(v as string) },
    { key: 'room_type',       label: 'Room Type',    fmt: (v) => (v as string) ?? '—' },
    { key: 'bar_level',       label: 'BAR Level',    fmt: (v) => (v as string) ?? '—' },
    { key: 'bar_rate_usd',    label: 'BAR (USD)',     fmt: (v) => fmtUSD(v as number) },
    { key: 'bar_rate_lak',    label: 'BAR (LAK)',     fmt: (v) => fmtLAK(v as number) },
    { key: 'occ_pct',         label: 'Occ %',        fmt: (v) => fmtPct(v as number) },
    { key: 'rooms_available', label: 'Avail',        fmt: (v) => fmtInt(v as number) },
    { key: 'rooms_sold',      label: 'Sold',         fmt: (v) => fmtInt(v as number) },
    { key: 'channel',         label: 'Channel',      fmt: (v) => (v as string) ?? '—' },
    { key: 'notes',           label: 'Notes',        fmt: (v) => (v as string) ?? '—' },
  ]

  return (
    <main style={{ padding: '2rem' }}>
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-2xl, 2rem)',
            letterSpacing: 'var(--ls-extra, 0.04em)',
            color: 'var(--brass, #b5903a)',
            margin: 0,
          }}
        >
          Pricing — BAR Ladder
        </h1>
        <span
          style={{
            fontSize: 'var(--t-sm, 0.875rem)',
            color: 'var(--muted, #888)',
          }}
        >
          {rows.length} rows · live from{' '}
          <code style={{ fontSize: 'inherit' }}>public.v_bar_ladder</code>
        </span>
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 && (
        <p
          style={{
            color: 'var(--muted, #888)',
            fontStyle: 'italic',
            fontSize: 'var(--t-base, 1rem)',
          }}
        >
          No BAR ladder data available — check that{' '}
          <code>public.v_bar_ladder</code> is populated.
        </p>
      )}

      {/* ── Table ── */}
      {rows.length > 0 && (
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
                  borderBottom: '2px solid var(--brass, #b5903a)',
                  textAlign: 'left',
                }}
              >
                {COLUMNS.map((col) => (
                  <th
                    key={col.key as string}
                    style={{
                      padding: '0.5rem 0.75rem',
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontWeight: 600,
                      color: 'var(--brass, #b5903a)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--border-subtle, #e5e5e5)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--row-alt, rgba(0,0,0,0.02))',
                  }}
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key as string}
                      style={{
                        padding: '0.45rem 0.75rem',
                        color: 'var(--text-primary, #1a1a1a)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.fmt(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
