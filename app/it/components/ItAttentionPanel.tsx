// v_tactical_alerts_top: if permission is denied at runtime, alerts prop arrives as [].
// PBS: confirm column `arm` exists on the view to add .eq('arm','it') filter in page.tsx.

interface Alert {
  id?: number | string;
  title?: string;
  message?: string;
  severity?: string;
  arm?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface Props {
  alerts: Alert[];
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--red)',
  warning: 'var(--amber)',
  medium: 'var(--amber)',
  low: 'var(--text-muted)',
  info: 'var(--blue)',
};

export default function ItAttentionPanel({ alerts }: Props) {
  return (
    <section
      style={{
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <h2
        style={{
          fontSize: 'var(--t-sm)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--text-muted)',
          margin: 0,
        }}
      >
        What needs your attention
      </h2>

      {alerts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--t-sm)', margin: 0 }}>
          All clear — no active alerts.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {alerts.map((alert, i) => {
            const sev = (alert.severity ?? 'info').toLowerCase();
            const color = SEVERITY_COLOR[sev] ?? 'var(--text-muted)';
            const label = alert.title ?? alert.message ?? JSON.stringify(alert);
            return (
              <li
                key={alert.id ?? i}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--t-sm)',
                }}
              >
                <span style={{ color, fontWeight: 700, minWidth: 72 }}>
                  {sev.toUpperCase()}
                </span>
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>{label ?? '—'}</span>
                {alert.created_at && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--t-xs)' }}>
                    {new Date(alert.created_at).toISOString().slice(0, 10)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
