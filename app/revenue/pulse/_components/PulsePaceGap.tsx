// app/revenue/pulse/_components/PulsePaceGap.tsx
//
// PBS 2026-05-09: single tile — "Pace gap": OTB next-N nights vs STLY same
// window. Computed from existing PaceCurveRow[] returned by getPaceCurve().
// We sum room-nights forward from today and convert to $ via current ADR
// (passed from page). Sentence-format: "we are $X ahead/behind STLY for
// the next Y nights".

import type { PaceCurveRow } from '@/lib/pulseData';
import { fmtKpi } from '@/lib/format';

interface Props {
  paceCurve: PaceCurveRow[];
  adrUsd: number; // current ADR for the period — used to dollarize room-night gap
}

const MINUS = '−';

export default function PulsePaceGap({ paceCurve, adrUsd }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const forward = paceCurve.filter((r) => r.day >= today);

  // Sum room-nights OTB forward, and STLY rooms over the same forward window.
  let otbSum = 0;
  let stlySum = 0;
  let nights = 0;
  let hasOtb = false;
  let hasStly = false;
  for (const r of forward) {
    if (r.rooms_otb != null) { otbSum += Number(r.rooms_otb); hasOtb = true; }
    if (r.rooms_stly_daily_avg != null) { stlySum += Number(r.rooms_stly_daily_avg); hasStly = true; }
    nights++;
  }

  if (nights === 0 || !hasOtb || !hasStly) {
    return (
      <div style={emptyBox}>
        No forward pace data available for this view.
      </div>
    );
  }

  const roomNightGap = otbSum - stlySum; // positive = ahead of STLY
  const dollarGap = roomNightGap * (adrUsd || 0);
  const pct = stlySum > 0 ? (roomNightGap / stlySum) * 100 : 0;

  const ahead = roomNightGap >= 0;
  const tone = ahead ? 'good' : 'bad';
  const fg = ahead ? 'var(--moss)' : 'var(--st-bad-tx, #b03826)';
  const bg = ahead ? 'var(--st-good-bg, #f0f4ec)' : 'var(--st-bad-bg, #fbeeea)';
  const bd = ahead ? 'var(--st-good-bd, #c2d1b1)' : 'var(--st-bad-bd, #e8c4ba)';

  const dollarStr = fmtKpi(Math.abs(dollarGap), 'usd', 1);
  const pctStr = `${ahead ? '+' : MINUS}${Math.abs(pct).toFixed(1)}%`;
  const rnStr = `${ahead ? '+' : MINUS}${Math.round(Math.abs(roomNightGap)).toLocaleString()} RN`;

  const sentence = ahead
    ? `We are ${dollarStr} ahead of STLY for the next ${nights} nights.`
    : `We are ${dollarStr} behind STLY for the next ${nights} nights.`;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${bd}`,
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          fontWeight: 600,
          color: 'var(--brass)',
        }}
      >
        Pace gap · OTB vs STLY
      </div>

      <div
        style={{
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
          fontSize: 'var(--t-2xl)',
          fontWeight: 500,
          color: fg,
          lineHeight: 1.05,
        }}
      >
        {ahead ? '+' : MINUS}{dollarStr.replace(MINUS, '')}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'baseline',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
        }}
      >
        <span>{pctStr}</span>
        <span>·</span>
        <span>{rnStr}</span>
        <span>·</span>
        <span>{nights}n window</span>
      </div>

      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginTop: 4 }}>
        {sentence}
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 6,
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          color: 'var(--ink-faint)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
        }}
      >
        adr ${Math.round(adrUsd || 0).toLocaleString()} · v_pace_curve
      </div>
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
  borderRadius: 8,
  height: '100%',
};
