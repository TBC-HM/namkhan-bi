// app/revenue/pulse/_components/PulseStatusHeader.tsx
//
// Status header for /revenue/pulse, mirroring the visual shell of the
// CompactAgentHeader on /revenue/compset and the RatePlansStatusHeader on
// /revenue/rateplans. Two rows, dense, same typography.
//
// Row 1: SOURCE · LAST REFRESH · PERIOD · CMP · SEG · DAYS
// Row 2: ALERT/DECISION counts · settings link

'use client';

import Link from 'next/link';
import StatusPill from '@/components/ui/StatusPill';

interface Props {
  periodLabel: string;
  rangeLabel: string;
  cmpLabel: string;
  segLabel: string;
  win: string;
  days: number;
  alertCount: number;
  decisionCount: number;
}

export default function PulseStatusHeader({
  periodLabel,
  rangeLabel,
  cmpLabel,
  segLabel,
  win,
  days,
  alertCount,
  decisionCount,
}: Props) {
  const alertTone = alertCount > 0 ? 'expired' : 'active';
  const decisionTone = decisionCount > 0 ? 'pending' : 'inactive';

  return (
    <div style={wrap}>
      <div style={row1}>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span>
          <StatusPill tone="active">CLOUDBEDS · USALI</StatusPill>
          <span style={metaDim}>· mv_kpi_daily · v_pace_curve · v_pickup_velocity_28d</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>PERIOD</span>
          <span style={meta}>{periodLabel}</span>
          <span style={metaDim}>· {rangeLabel}</span>
        </div>
        <span style={{ flex: 1 }} />
        <span style={metaDim}>
          win={win} · cmp={cmpLabel || 'none'} · seg={segLabel} · {days}d
        </span>
      </div>

      <div style={row2}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>ALERTS</span>
        <StatusPill tone={alertTone}>{alertCount}</StatusPill>
        <span style={metaDim}>tactical signals open</span>
        <span style={{ width: 16 }} />
        <span className="t-eyebrow" style={{ marginRight: 6 }}>DECISIONS</span>
        <StatusPill tone={decisionTone}>{decisionCount}</StatusPill>
        <span style={metaDim}>queued for action</span>
        <span style={{ flex: 1 }} />
        <Link href="/revenue/rateplans" style={linkBtn}>RATE PLANS</Link>
        <Link href="/revenue/compset" style={linkBtn}>COMP SET</Link>
        <Link href="/revenue/pace" style={linkBtn}>PACE</Link>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  marginTop: 14,
  overflow: 'hidden',
};
const row1: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 18,
  padding: '10px 16px',
  borderBottom: '1px solid var(--paper-deep)',
  flexWrap: 'wrap',
};
const row2: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 16px',
  fontSize: 'var(--t-xs)',
  flexWrap: 'wrap',
};
const cell: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const meta: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)',
};
const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
  letterSpacing: 'var(--ls-loose)',
};
const linkBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  fontWeight: 600,
  background: 'var(--paper)',
  color: 'var(--ink-soft)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  textDecoration: 'none',
};
