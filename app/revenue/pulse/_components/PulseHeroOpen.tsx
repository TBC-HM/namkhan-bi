// app/revenue/pulse/_components/PulseHeroOpen.tsx
//
// PBS 2026-05-09: "What's open" — top-3 most actionable tactical alerts for
// a revenue manager. Each row deep-links to /cockpit/chat?dept=revenue&q=…
// so the RM can ask Vector about the alert in one click.
//
// Reads existing TacticalAlertRow[] from getTacticalAlertsTop() — no schema
// change. Severity ordering already done server-side; we slice 3.

import Link from 'next/link';
import type { TacticalAlertRow } from '@/lib/pulseData';

interface Props {
  alerts: TacticalAlertRow[];
}

const SEV_TONE: Record<string, { bg: string; bd: string; tx: string }> = {
  CRITICAL: { bg: 'var(--st-bad-bg)',  bd: 'var(--st-bad-bd)',  tx: 'var(--st-bad-tx, #b03826)' },
  WARNING:  { bg: 'var(--st-warn-bg)', bd: 'var(--st-warn-bd)', tx: 'var(--st-warn-tx, #8a6418)' },
  INFO:     { bg: 'var(--paper)',      bd: 'var(--paper-deep)', tx: 'var(--ink-soft)' },
};

function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function vectorHref(a: TacticalAlertRow): string {
  const q = `${a.title} — ${a.description} (dim: ${a.dim_label} = ${a.dim_value}, source: ${a.source}, severity: ${a.severity}). What should I do as revenue manager?`;
  const params = new URLSearchParams({ dept: 'revenue', q });
  return `/cockpit/chat?${params.toString()}`;
}

export default function PulseHeroOpen({ alerts }: Props) {
  const top = alerts.slice(0, 3);

  if (top.length === 0) {
    return (
      <div style={emptyBox}>
        No open signals — pricing, distribution, and DQ all clean.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top.map((a, i) => {
        const t = SEV_TONE[a.severity] ?? SEV_TONE.INFO;
        return (
          <div
            key={`${a.alert_id}-${i}`}
            style={{
              background: t.bg,
              border: `1px solid ${t.bd}`,
              borderRadius: 6,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
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
              <span style={{ flex: 1 }} />
              <span style={{ ...metaDim, textTransform: 'uppercase' }}>
                {a.dim_label}: {a.dim_value}
              </span>
            </div>
            <div style={{ fontSize: 'var(--t-md)', fontWeight: 500, color: 'var(--ink)' }}>
              {a.title}
            </div>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
              {a.description}
            </div>
            <div style={{ marginTop: 2 }}>
              <Link href={vectorHref(a)} style={askBtn}>Ask Vector</Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const emptyBox: React.CSSProperties = {
  padding: '24px 12px',
  textAlign: 'center',
  color: 'var(--ink-mute)',
  fontStyle: 'italic',
  fontSize: 'var(--t-sm)',
  background: 'var(--paper)',
  border: '1px dashed var(--paper-deep)',
  borderRadius: 6,
};

const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink-mute)',
  letterSpacing: 'var(--ls-loose)',
};

const askBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  background: 'var(--ink)',
  color: 'var(--paper)',
  border: '1px solid var(--ink)',
  borderRadius: 4,
  textDecoration: 'none',
};
