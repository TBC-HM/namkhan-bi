// v_tactical_alerts_top: ARM FILTER ASSUMPTION — view may not expose 'arm' column.
// Showing all alerts as a fallback. PBS: confirm column presence in PR review.
// If arm column exists, parent query should add .eq('arm','it') before passing alertRows.

interface Alert {
  id?: number | string
  title?: string
  message?: string
  severity?: string
  arm?: string
  created_at?: string
  [key: string]: unknown
}

interface Props {
  alerts: Alert[]
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--red)',
  warning: 'var(--amber)',
  medium: 'var(--amber)',
  low: 'var(--text-muted)',
  info: 'var(--blue)',
}

export default function ItAttentionPanel({ alerts }: Props) {
  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2
        style={{
          fontSize: 'var(--t-lg)',
          fontWeight: 600,
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
          marginBottom: 'var(--space-3)',
        }}
      >
        What needs your attention
      </h2>

      {alerts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--t-sm)' }}>
          All clear — no active alerts.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {alerts.map((alert, i) => {
            const sev = (alert.severity ?? 'info').toLowerCase()
            const color = SEVERITY_COLOR[sev] ?? 'var(--text-muted)'
            const label =
              alert.title ??
              alert.message ??
              JSON.stringify(alert)
            return (
              <li
                key={alert.id ?? i}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${color}`,
                  fontSize: 'var(--t-sm)',
                }}
              >
                <span style={{ fontWeight: 600, color }}>{sev.toUpperCase()}</span>
                {'  '}
                {label ?? '—'}
                {alert.created_at && (
                  <span
                    style={{
                      marginLeft: 'var(--space-3)',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--t-xs)',
                    }}
                  >
                    {new Date(alert.created_at).toISOString().slice(0, 10)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
