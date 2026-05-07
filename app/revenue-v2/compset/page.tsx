import { createClient } from '@supabase/supabase-js'
import { KpiBox } from '@/components/kpi/KpiBox'

export const revalidate = 3600

interface CompsetRow {
  property_name: string
  stay_date: string
  occ_pct: number | null
  adr_usd: number | null
  revpar_usd: number | null
  source: string | null
  fetched_at: string | null
}

async function getCompsetData(): Promise<CompsetRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('v_compset_index')
    .select('property_name, stay_date, occ_pct, adr_usd, revpar_usd, source, fetched_at')
    .order('stay_date', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[compset] fetch error:', error.message)
    return []
  }

  return (data ?? []) as CompsetRow[]
}

function fmt(val: number | null, prefix = '') {
  if (val == null) return '—'
  return `${prefix}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function fmtPct(val: number | null) {
  if (val == null) return '—'
  return `${(val * 100).toFixed(1)}%`
}

export default async function CompsetPage() {
  const rows = await getCompsetData()

  // Aggregate KPIs — average across all returned rows
  const withOcc = rows.filter(r => r.occ_pct != null)
  const withAdr = rows.filter(r => r.adr_usd != null)
  const withRevpar = rows.filter(r => r.revpar_usd != null)

  const avgOcc =
    withOcc.length > 0
      ? withOcc.reduce((s, r) => s + r.occ_pct!, 0) / withOcc.length
      : null

  const avgAdr =
    withAdr.length > 0
      ? withAdr.reduce((s, r) => s + r.adr_usd!, 0) / withAdr.length
      : null

  const avgRevpar =
    withRevpar.length > 0
      ? withRevpar.reduce((s, r) => s + r.revpar_usd!, 0) / withRevpar.length
      : null

  const properties = Array.from(new Set(rows.map(r => r.property_name))).length

  return (
    <main style={{ padding: 'var(--space-6)', fontFamily: 'var(--font-sans)' }}>
      <h1
        style={{
          fontSize: 'var(--t-2xl)',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          marginBottom: 'var(--space-2)',
          textTransform: 'uppercase',
        }}
      >
        Competitive Set
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 'var(--t-sm)', marginBottom: 'var(--space-6)' }}>
        Live compset snapshot · {rows.length} rate records · {properties} properties
      </p>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}
      >
        <KpiBox label="Compset Avg OCC" value={fmtPct(avgOcc)} />
        <KpiBox label="Compset Avg ADR" value={fmt(avgAdr, '$')} />
        <KpiBox label="Compset Avg RevPAR" value={fmt(avgRevpar, '$')} />
        <KpiBox label="Properties Tracked" value={properties > 0 ? String(properties) : '—'} />
      </div>

      {/* Detail table */}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          No compset data available — v_compset_index returned no rows.
        </p>
      ) : (
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
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Property</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Stay Date</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>OCC %</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>ADR</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>RevPAR</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Source</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Fetched</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                  }}
                >
                  <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500 }}>
                    {row.property_name ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--muted)' }}>
                    {row.stay_date ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                    {fmtPct(row.occ_pct)}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                    {fmt(row.adr_usd, '$')}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right' }}>
                    {fmt(row.revpar_usd, '$')}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--muted)' }}>
                    {row.source ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', color: 'var(--muted)' }}>
                    {row.fetched_at ? row.fetched_at.slice(0, 10) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
