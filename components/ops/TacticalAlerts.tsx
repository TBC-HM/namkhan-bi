// components/ops/TacticalAlerts.tsx
// Block 7 — Tactical alerts.
// Severity border, dimensions tagged, detector reasoning, composer tactic, handoff buttons.

export type AlertSeverity = 'hi' | 'med' | 'low';

export interface AlertHandoff {
  label: string;
  writesExternal?: boolean;  // adds "writes X · approval req" stamp
  stampLabel?: string;       // e.g. "writes WA · approval req"
}

export interface TacticalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;             // e.g. "3 rooms · VIP × <2h ETA × not inspected"
  severityLabel: string;     // e.g. "SLA HIGH"
  dims: string;              // dimension chain, e.g. "room_category × time_to_arrival × inspection_status"
  reason: string;            // detector + composer narrative
  handoffs: AlertHandoff[];
}

interface Props {
  alerts: TacticalAlert[];
}

const sevColor: Record<AlertSeverity, { left: string; bg: string; impColor: string }> = {
  hi: { left: '#a02d2d', bg: '#fdf3f0', impColor: '#a02d2d' },
  med: { left: '#a87024', bg: '#fdf6e7', impColor: '#a87024' },
  low: { left: '#a89c80', bg: '#fff', impColor: '#8a8170' },
};

export default function TacticalAlerts({ alerts }: Props) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '22px 0 10px',
        }}
      >
        <h3
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          Tactical <em style={{ color: '#a17a4f' }}>alerts</em>
        </h3>
        <span style={{ fontSize: 12, color: '#8a8170' }}>
          cross-dim · detector → composer → handoff
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {alerts.map((a) => {
          const sc = sevColor[a.severity];
          return (
            <div
              key={a.id}
              style={{
                padding: 14,
                background: sc.bg,
                border: '1px solid #e6dfc9',
                borderLeft: `5px solid ${sc.left}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  margin: '0 0 4px',
                  fontFamily: 'Georgia, serif',
                  fontSize: 15,
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>{a.title}</span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: 12,
                    color: sc.impColor,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.severityLabel}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#8a8170', marginBottom: 6 }}>
                {a.dims}
              </div>
              <div style={{ fontSize: 12.5, color: '#4a4538', marginBottom: 4 }}>
                {a.reason}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {a.handoffs.map((h, i) => (
                  <button
                    type="button"
                    key={h.label}
                    style={
                      i === 0
                        ? {
                            fontSize: 11.5,
                            padding: '6px 11px',
                            borderRadius: 5,
                            background: '#a17a4f',
                            color: '#fff8eb',
                            border: '1px solid #a17a4f',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }
                        : {
                            fontSize: 11.5,
                            padding: '6px 11px',
                            borderRadius: 5,
                            background: '#fff',
                            color: '#1c1c1a',
                            border: '1px solid #e6dfc9',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }
                    }
                  >
                    {h.label}
                    {h.writesExternal && h.stampLabel && (
                      <span
                        style={{
                          fontSize: 9.5,
                          background: '#fef3c7',
                          border: '1px solid #f3d57a',
                          color: '#5e4818',
                          padding: '1px 5px',
                          borderRadius: 3,
                          marginLeft: 4,
                        }}
                      >
                        {h.stampLabel}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
