import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type AgentRow = {
  agent_id: number
  role: string
  department: string
  active: boolean
  status: string
  created_at: string
  last_call_at: string | null
  recent_failures: number
  recent_calls: number
  minutes_since_last_call: number | null
  health_state: string
}

const HEALTH_BADGE: Record<string, { label: string; color: string }> = {
  healthy:          { label: 'Healthy',         color: 'var(--green-600, #16a34a)' },
  failing:          { label: 'Failing',          color: 'var(--red-600, #dc2626)'   },
  new:              { label: 'New',              color: 'var(--blue-500, #3b82f6)'  },
  never_run_stale:  { label: 'Never Run',        color: 'var(--amber-500, #f59e0b)' },
  archived:         { label: 'Archived',         color: 'var(--neutral-400, #a1a1aa)'},
}

function badge(state: string) {
  const b = HEALTH_BADGE[state] ?? { label: state, color: 'var(--neutral-400, #a1a1aa)' }
  return (
    <span
      style={{
        backgroundColor: b.color,
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 'var(--t-xs, 11px)',
        fontWeight: 600,
        letterSpacing: 'var(--ls-extra, 0.08em)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {b.label}
    </span>
  )
}

function fmtMinutes(m: number | null): string {
  if (m === null) return '—'
  if (m < 60) return `${m.toFixed(0)} min ago`
  const h = m / 60
  if (h < 24) return `${h.toFixed(1)} h ago`
  return `${(h / 24).toFixed(1)} d ago`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10) // YYYY-MM-DD
}

export default async function AgentsPage() {
  const { data, error } = await supabase
    .from('v_agent_health')
    .select('*')
    .order('health_state')
    .order('role')

  const rows: AgentRow[] = data ?? []

  const totalActive   = rows.filter(r => r.active).length
  const totalFailing  = rows.filter(r => r.health_state === 'failing').length
  const totalHealthy  = rows.filter(r => r.health_state === 'healthy').length
  const totalArchived = rows.filter(r => !r.active).length

  return (
    <main style={{ padding: '2rem', fontFamily: 'var(--font-sans, sans-serif)', color: 'var(--text-primary, #111)' }}>

      {/* ── Header ── */}
      <h1 style={{ fontSize: 'var(--t-2xl, 1.5rem)', fontWeight: 700, marginBottom: '0.25rem' }}>
        Agent Health
      </h1>
      <p style={{ fontSize: 'var(--t-sm, 0.875rem)', color: 'var(--text-muted, #666)', marginBottom: '2rem' }}>
        Live from <code>v_agent_health</code> · {rows.length} agents total
      </p>

      {error && (
        <div style={{ color: 'var(--red-600, #dc2626)', marginBottom: '1rem' }}>
          ⚠ Data error: {error.message}
        </div>
      )}

      {/* ── KPI strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {[
          { label: 'Active',   value: totalActive,   accent: 'var(--brass, #b8943c)' },
          { label: 'Healthy',  value: totalHealthy,  accent: 'var(--green-600, #16a34a)' },
          { label: 'Failing',  value: totalFailing,  accent: 'var(--red-600, #dc2626)' },
          { label: 'Archived', value: totalArchived, accent: 'var(--neutral-400, #a1a1aa)' },
        ].map(k => (
          <div
            key={k.label}
            style={{
              background: 'var(--surface-2, #f9f9f9)',
              border: `2px solid ${k.accent}`,
              borderRadius: 8,
              padding: '1rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 'var(--t-2xl, 1.5rem)', fontWeight: 700, color: k.accent }}>
              {k.value}
            </div>
            <div style={{ fontSize: 'var(--t-xs, 11px)', letterSpacing: 'var(--ls-extra, 0.08em)', textTransform: 'uppercase', color: 'var(--text-muted, #666)', marginTop: 4 }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--t-sm, 0.875rem)',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--brass, #b8943c)', textAlign: 'left' }}>
              {['ID', 'Role', 'Department', 'Status', 'Recent Calls', 'Recent Failures', 'Last Call', 'Health'].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: 'var(--t-xs, 11px)',
                    letterSpacing: 'var(--ls-extra, 0.08em)',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted, #666)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.agent_id}
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'var(--surface-2, #f9f9f9)',
                  borderBottom: '1px solid var(--border, #e5e5e5)',
                  opacity: r.active ? 1 : 0.55,
                }}
              >
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted, #666)' }}>{r.agent_id}</td>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{r.role ?? '—'}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{r.department ?? '—'}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{r.status ?? '—'}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.recent_calls}</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: r.recent_failures > 0 ? 'var(--red-600, #dc2626)' : 'inherit' }}>
                  {r.recent_failures > 0 ? `−${r.recent_failures}` : r.recent_failures}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>{fmtMinutes(r.minutes_since_last_call)}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{badge(r.health_state)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #666)' }}>
                  No agents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <p style={{ marginTop: '1.5rem', fontSize: 'var(--t-xs, 11px)', color: 'var(--text-muted, #666)' }}>
        Generated {new Date().toISOString().slice(0, 10)} · Archived agents shown at 55 % opacity
      </p>
    </main>
  )
}
