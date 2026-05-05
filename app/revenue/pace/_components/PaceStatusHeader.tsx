// app/revenue/pace/_components/PaceStatusHeader.tsx
//
// Status header for /revenue/pace, mirroring CompactAgentHeader visual shell.

'use client';

import StatusPill from '@/components/ui/StatusPill';

interface Props {
  windowLabel: string;
  rangeLabel: string;
  capacityRn: number;
  straddles: boolean;
  capacityPivot: string;
  capacityPre: number;
  capacityPost: number;
  stlySource: 'snapshot' | 'actuals_proxy';
  stlyCoverage: number;
  totalDays: number;
}

export default function PaceStatusHeader({
  windowLabel,
  rangeLabel,
  capacityRn,
  straddles,
  capacityPivot,
  capacityPre,
  capacityPost,
  stlySource,
  stlyCoverage,
  totalDays,
}: Props) {
  return (
    <div style={wrap}>
      <div style={row1}>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span>
          <StatusPill tone="active">v_otb_pace</StatusPill>
          <span style={metaDim}>· forward on-the-books</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>WINDOW</span>
          <span style={meta}>{windowLabel}</span>
          <span style={metaDim}>· {rangeLabel}</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>CAPACITY</span>
          <span style={metaStrong}>{capacityRn.toLocaleString()} RN</span>
          {straddles ? (
            <span style={metaDim}>· flips {capacityPre}→{capacityPost} on {capacityPivot}</span>
          ) : null}
        </div>
        <span style={{ flex: 1 }} />
      </div>
      <div style={row2}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>STLY</span>
        <StatusPill tone={stlySource === 'snapshot' ? 'active' : 'pending'}>
          {stlySource === 'snapshot' ? 'SNAPSHOT' : 'ACTUALS PROXY'}
        </StatusPill>
        <span style={metaDim}>
          {stlySource === 'snapshot'
            ? '· true OTB-as-of-then (1y ago)'
            : '· last-year actuals at same dates · snapshots accumulating since 2026-05-03'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={metaDim}>
          coverage: {stlyCoverage} of {totalDays} nights
        </span>
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
const metaStrong: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 600,
};
const metaDim: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
  letterSpacing: 'var(--ls-loose)',
};
