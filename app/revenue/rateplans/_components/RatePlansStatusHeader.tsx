// app/revenue/rateplans/_components/RatePlansStatusHeader.tsx
//
// Status header for /revenue/rateplans, mirroring the visual shell of the
// CompactAgentHeader on /revenue/compset. Two rows, dense, same typography.
//
// Rate plans has no scraping agent (data flows from Cloudbeds reservations),
// so instead of "agent / last run / cost / next event" we show:
//   Row 1: SOURCE · LAST BOOKING · ACTIVE PLANS · SLEEPING · ORPHANS · period
//   Row 2: TOP TYPES (chips) · concentration · settings link

'use client';

import Link from 'next/link';
import StatusPill from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';

interface Props {
  lastBookingDate: string | null;     // ISO yyyy-mm-dd of most recent booking captured
  activeMasterCount: number;
  bookingInWindow: number;
  sleepingCount: number;
  orphanCount: number;
  topTypes: { type: string; mix: number }[];
  top3Pct: number;
  periodLabel: string;
  rangeLabel: string;
}

function fmtRel(iso: string | null): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RatePlansStatusHeader({
  lastBookingDate,
  activeMasterCount,
  bookingInWindow,
  sleepingCount,
  orphanCount,
  topTypes,
  top3Pct,
  periodLabel,
  rangeLabel,
}: Props) {
  const orphanTone = orphanCount > 0 ? 'expired' : 'active';
  const sleepingTone = sleepingCount > 50 ? 'pending' : 'inactive';

  return (
    <div style={wrap}>
      {/* Row 1: source · last booking · plan counts · alerts · period */}
      <div style={row1}>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span>
          <StatusPill tone="active">CLOUDBEDS</StatusPill>
          <span style={metaDim}>· reservations + rate_plans</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>LAST BOOKING</span>
          <span style={meta}>{fmtIsoDate(lastBookingDate)}</span>
          <span style={metaDim}>· {fmtRel(lastBookingDate)}</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>ACTIVE PLANS</span>
          <span style={metaStrong}>{bookingInWindow}/{activeMasterCount}</span>
          <span style={metaDim}>booking in {periodLabel.toLowerCase()}</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>SLEEPING</span>
          <StatusPill tone={sleepingTone}>{sleepingCount}</StatusPill>
          <span style={metaDim}>≥90d idle</span>
        </div>
        <div style={cell}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>ORPHANS</span>
          <StatusPill tone={orphanTone}>{orphanCount}</StatusPill>
          <span style={metaDim}>not in master</span>
        </div>
        <span style={{ flex: 1 }} />
        <span style={metaDim}>{rangeLabel}</span>
      </div>

      {/* Row 2: top type chips · concentration · settings link */}
      <div style={row2}>
        <span className="t-eyebrow" style={{ marginRight: 6 }}>TOP TYPES</span>
        {topTypes.length === 0 ? (
          <span style={metaDim}>none</span>
        ) : (
          <div style={pillsWrap}>
            {topTypes.slice(0, 5).map((t) => (
              <span key={t.type} style={chip}>
                {t.type} <span style={chipPct}>{t.mix.toFixed(0)}%</span>
              </span>
            ))}
          </div>
        )}
        <span style={{ flex: 1 }} />
        <span style={metaDim}>TOP 3 = {top3Pct.toFixed(0)}% of revenue</span>
        <Link href="/revenue/compset" style={linkBtn}>COMP RATES</Link>
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
const pillsWrap: React.CSSProperties = { display: 'inline-flex', gap: 4, flexWrap: 'wrap' };
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px',
  background: 'var(--paper)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink)',
};
const chipPct: React.CSSProperties = {
  color: 'var(--ink-mute)', fontWeight: 600,
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
