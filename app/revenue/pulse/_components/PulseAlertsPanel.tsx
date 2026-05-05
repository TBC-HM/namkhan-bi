// app/revenue/pulse/_components/PulseAlertsPanel.tsx
//
// Tactical alerts + decisions queued — clean React rendering, replaces the
// tabPulse HTML mockup patching.

import type { TacticalAlertRow, DecisionQueuedRow } from '@/lib/pulseData';

interface Props {
  alerts: TacticalAlertRow[];
  decisions: DecisionQueuedRow[];
}

function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function fmtUsdSigned(n: number | null): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const SEV_TONE: Record<string, { bg: string; bd: string; tx: string }> = {
  CRITICAL: { bg: 'var(--st-bad-bg)',  bd: 'var(--st-bad-bd)',  tx: 'var(--st-bad-tx, #b03826)' },
  WARNING:  { bg: 'var(--st-warn-bg)', bd: 'var(--st-warn-bd)', tx: 'var(--st-warn-tx, #8a6418)' },
  INFO:     { bg: 'var(--paper)',      bd: 'var(--paper-deep)', tx: 'var(--ink-soft)' },
};

export default function PulseAlertsPanel({ alerts, decisions }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}
    >
      {/* Tactical alerts */}
      <div style={card}>
        <SectionHead
          title="Tactical alerts"
          emphasis={`${alerts.length} signal${alerts.length === 1 ? '' : 's'}`}
          sub="Cross-dimensional gaps · DQ · GL · staff · compset"
          source="v_tactical_alerts_top"
        />
        {alerts.length === 0 ? (
          <Empty msg="No active alerts." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {alerts.map((a, i) => {
              const t = SEV_TONE[a.severity] ?? SEV_TONE.INFO;
              return (
                <div
                  key={`${a.source}-${a.title}-${i}`}
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.bd}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline',
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 'var(--t-xs)',
                          letterSpacing: 'var(--ls-extra)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: t.tx,
                        }}
                      >
                        {a.severity}
                      </span>
                      <span style={metaDim}>{a.source}</span>
                      <span style={metaDim}>{fmtAge(a.hours_open)} open</span>
                    </div>
                    <div style={{ fontSize: 'var(--t-md)', fontWeight: 500, color: 'var(--ink)' }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginTop: 2 }}>
                      {a.description}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      color: 'var(--ink-mute)',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)' }}>
                      {a.dim_label}
                    </div>
                    <div style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                      {a.dim_value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decisions queued */}
      <div style={card}>
        <SectionHead
          title="Decisions queued"
          emphasis={`${decisions.length} action${decisions.length === 1 ? '' : 's'}`}
          sub="Ranked by $ impact · from active agents"
          source="v_decisions_queued_top"
        />
        {decisions.length === 0 ? (
          <Empty msg="No decisions queued — agents will populate when they detect actionable plays." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {decisions.map((d, i) => {
              const positive = (d.impact_usd ?? 0) >= 0;
              return (
                <div
                  key={`${d.source_agent}-${d.title}-${i}`}
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--paper-deep)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--serif)',
                      fontStyle: 'italic',
                      fontSize: 'var(--t-lg)',
                      fontWeight: 500,
                      minWidth: 70,
                      color: positive ? 'var(--moss)' : 'var(--st-bad-tx, #b03826)',
                    }}
                  >
                    {fmtUsdSigned(d.impact_usd)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--t-md)', fontWeight: 500, color: 'var(--ink)' }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
                      From {d.source_agent} · {fmtAge(d.hours_open)} open
                      {d.confidence_pct != null && ` · ${d.confidence_pct.toFixed(0)}% conf`}
                      {d.velocity && ` · ${d.velocity}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({
  title,
  emphasis,
  sub,
  source,
}: {
  title: string;
  emphasis?: string;
  sub?: string;
  source?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 'var(--t-xl)',
            fontWeight: 500,
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}
        >
          {title}
          {emphasis && (
            <span
              style={{
                marginLeft: 8,
                fontFamily: 'var(--mono)',
                fontStyle: 'normal',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                color: 'var(--brass)',
              }}
            >
              {emphasis}
            </span>
          )}
        </div>
        {sub && (
          <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
            {sub}
          </div>
        )}
      </div>
      {source && (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-loose)',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          {source}
        </span>
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: '24px 12px',
        textAlign: 'center',
        color: 'var(--ink-mute)',
        fontStyle: 'italic',
        fontSize: 'var(--t-sm)',
      }}
    >
      {msg}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
};
const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink-mute)',
  letterSpacing: 'var(--ls-loose)',
};
