// app/(cockpit)/_design/PickupMatrix.tsx
// Monthly pickup matrix primitive — pure paper-white surface.
//
// 2026-05-21 v3 fixes:
// - block-style month separation: a single thick rule above each month's
//   RN row, NO horizontal rules between RN/OCC/REV/ADR/RevPAR inside the
//   block. Matches the PDF "block per month" feel.
// - tighter row height (cells were 8/10px padding → 3/8px)
// - delta cells coloured green/red so the polarity reads at a glance —
//   not just for explicit delta columns, but also for the SDLY Δ.
// - subtle alternating month tint so consecutive blocks distinguish without
//   adding more rules.

import type { CSSProperties } from 'react';

export type PickupMetric = 'RN' | 'OCC' | 'REV' | 'ADR' | 'RevPAR';

export interface PickupDelta {
  abs: number | null;
  pct: number | null;
}

export interface PickupMatrixRow {
  metric: PickupMetric;
  baseline2023: number | null;
  baseline2024: number | null;
  baseline2025: number | null;
  budget2026:   number | null;
  otbAll:       number | null;
  otbMonthly:   number | null;
  otbMonday:    number | null;
  otbYesterday: number | null;
  otbToday:     number | null;
  pickupMonthly:   PickupDelta;
  pickupWeekly:    PickupDelta;
  pickupYesterday: PickupDelta;
  vsBudget: PickupDelta;
  vsLy:     PickupDelta;
  sdly:     number | null;
  sdlyDiff: number | null;
}

export interface PickupMatrixMonth {
  monthKey: string;
  monthLabel: string;
  rows: PickupMatrixRow[];
}

export interface PickupMatrixData {
  property: string;
  capacity: number;
  asOfDate: string;
  monthlySnapshotLabel: string;
  mondaySnapshotLabel: string;
  yesterdaySnapshotLabel: string;
  todaySnapshotLabel: string;
  sdlyDate: string;
  months: PickupMatrixMonth[];
  total: PickupMatrixRow[];
  stalenessNote?: string;
}

interface Props { data: PickupMatrixData }

const PAPER       = '#FFFFFF';
const BLOCK_TINT  = '#FAFAF7';   // subtle alt-block tint
const INK         = '#1B1B1B';
const INK_SOFT    = '#5A5A5A';
const HAIRLINE    = '#E0DAC4';
const BLOCK_RULE  = '#E6DFCC';   // hairline rule between month blocks (was ink-black — too heavy)

const fmtInt   = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtUsd   = (n: number) => '€' + Math.round(n).toLocaleString('en-US');
const fmtPct   = (n: number) => `${n.toFixed(1)}%`;
const fmtDelta = (n: number, asPct: boolean) => (n >= 0 ? '+' : '') + (asPct ? fmtPct(n) : fmtInt(n));

function fmtMetric(metric: PickupMetric, val: number): string {
  if (metric === 'OCC') return fmtPct(val);
  if (metric === 'RN')  return fmtInt(val);
  return fmtUsd(val);
}

function cell(val: number | null, metric: PickupMetric): { text: string; muted: boolean; negative: boolean } {
  if (val == null || !Number.isFinite(val)) return { text: '—', muted: true, negative: false };
  return { text: fmtMetric(metric, val), muted: false, negative: val < 0 };
}

function deltaCell(d: PickupDelta | undefined, metric: PickupMetric, kind: 'abs' | 'pct') {
  const raw = kind === 'abs' ? d?.abs : d?.pct;
  if (raw == null || !Number.isFinite(raw)) return { text: '—', tone: 'mute' as const };
  const positive = raw > 0;
  const negative = raw < 0;
  const text = kind === 'abs' ? fmtDelta(raw, false) + (metric === 'OCC' ? 'pp' : '') : fmtDelta(raw, true);
  const tone = positive ? 'good' : negative ? 'bad' : 'mute';
  return { text, tone };
}

export default function PickupMatrix({ data }: Props) {
  return (
    <div style={S.scroll}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.groupTh, ...S.frozen, ...S.frozenHead, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>As of {data.asOfDate}</div>
              {data.stalenessNote && (
                <div style={{ fontSize: 10, color: INK_SOFT, marginTop: 2, fontStyle: 'italic' }}>{data.stalenessNote}</div>
              )}
            </th>
            <th style={S.groupTh} colSpan={4}>Baselines</th>
            <th style={S.groupTh} colSpan={5}>OTB snapshots</th>
            <th style={S.groupTh} colSpan={3}>Pickup</th>
            <th style={S.groupTh} colSpan={4}>Comparison</th>
            <th style={S.groupTh} colSpan={2}>SDLY · {data.sdlyDate}</th>
          </tr>
          <tr>
            <th style={{ ...S.headerTh, ...S.frozen, ...S.frozenHead, textAlign: 'left' }}>Month · Metric</th>
            <th style={S.headerTh}>2023 RO</th>
            <th style={S.headerTh}>2024 RO</th>
            <th style={S.headerTh}>2025 RO</th>
            <th style={S.headerTh}>Budget 2026</th>
            <th style={S.headerTh}>OTB ALL 2026</th>
            <th style={S.headerTh}>Monthly<div style={S.headerSub}>{data.monthlySnapshotLabel}</div></th>
            <th style={S.headerTh}>Monday<div style={S.headerSub}>{data.mondaySnapshotLabel}</div></th>
            <th style={S.headerTh}>Yesterday<div style={S.headerSub}>{data.yesterdaySnapshotLabel}</div></th>
            <th style={S.headerTh}>Today<div style={{ ...S.headerSub, fontWeight: 700, color: 'var(--ink, #1B1B1B)' }}>{data.todaySnapshotLabel}</div></th>
            <th style={S.headerTh}>Monthly</th>
            <th style={S.headerTh}>Weekly</th>
            <th style={S.headerTh}>Yesterday</th>
            <th style={S.headerTh} colSpan={2}>OTB vs Budget</th>
            <th style={S.headerTh} colSpan={2}>OTB vs LY</th>
            <th style={S.headerTh}>SDLY value</th>
            <th style={S.headerTh}>Δ vs SDLY</th>
          </tr>
        </thead>
        <tbody>
          {data.months.map((m, monthIdx) => (
            <MonthBlock key={m.monthKey} month={m} isAlt={monthIdx % 2 === 1} />
          ))}
          <MonthBlock month={{ monthKey: 'TOTAL', monthLabel: 'TOTAL 2026', rows: data.total }} isAlt={false} isTotal />
        </tbody>
      </table>
    </div>
  );
}

function MonthBlock({ month, isAlt, isTotal }: { month: PickupMatrixMonth; isAlt: boolean; isTotal?: boolean }) {
  const bg = isTotal ? PAPER : isAlt ? BLOCK_TINT : PAPER;
  return (
    <>
      {month.rows.map((r, i) => {
        const isFirstInBlock = i === 0;
        // Block separator on the FIRST row of every month; nothing between metrics.
        const borderTop = isFirstInBlock
          ? (isTotal ? `2px solid ${BLOCK_RULE}` : `1.5px solid ${BLOCK_RULE}`)
          : 'none';
        return (
          <tr key={`${month.monthKey}-${r.metric}`} style={{ background: bg }}>
            <th style={{
              ...S.rowHead,
              ...S.frozen,
              background: bg,
              borderTop,
              fontWeight: isTotal ? 700 : 500,
              borderBottom: 'none',
            }}>
              {isFirstInBlock && (
                <div style={S.monthLabel}>{month.monthLabel}</div>
              )}
              <div style={S.metricLabel}>{r.metric}</div>
            </th>
            <Cell val={r.baseline2023} metric={r.metric} borderTop={borderTop} />
            <Cell val={r.baseline2024} metric={r.metric} borderTop={borderTop} />
            <Cell val={r.baseline2025} metric={r.metric} borderTop={borderTop} />
            <Cell val={r.budget2026}   metric={r.metric} borderTop={borderTop} />
            <Cell val={r.otbAll}       metric={r.metric} emphasis borderTop={borderTop} />
            <Cell val={r.otbMonthly}   metric={r.metric} borderTop={borderTop} />
            <Cell val={r.otbMonday}    metric={r.metric} borderTop={borderTop} />
            <Cell val={r.otbYesterday} metric={r.metric} borderTop={borderTop} />
            <Cell val={r.otbToday}     metric={r.metric} emphasis borderTop={borderTop} />
            <DeltaCell d={r.pickupMonthly}   metric={r.metric} kind="abs" borderTop={borderTop} />
            <DeltaCell d={r.pickupWeekly}    metric={r.metric} kind="abs" borderTop={borderTop} />
            <DeltaCell d={r.pickupYesterday} metric={r.metric} kind="abs" borderTop={borderTop} />
            <DeltaCell d={r.vsBudget} metric={r.metric} kind="abs" borderTop={borderTop} />
            <DeltaCell d={r.vsBudget} metric={r.metric} kind="pct" borderTop={borderTop} />
            <DeltaCell d={r.vsLy}     metric={r.metric} kind="abs" borderTop={borderTop} />
            <DeltaCell d={r.vsLy}     metric={r.metric} kind="pct" borderTop={borderTop} />
            <Cell val={r.sdly}     metric={r.metric} borderTop={borderTop} />
            <DeltaCell d={{ abs: r.sdlyDiff, pct: null }} metric={r.metric} kind="abs" borderTop={borderTop} />
          </tr>
        );
      })}
    </>
  );
}

function Cell({ val, metric, emphasis, borderTop }: { val: number | null; metric: PickupMetric; emphasis?: boolean; borderTop: string }) {
  const c = cell(val, metric);
  // Negative absolute values get red, positive emphasis cells stay ink.
  const color = c.muted ? INK_SOFT : c.negative ? '#8A2A1D' : INK;
  return (
    <td style={{
      ...S.td,
      borderTop,
      color,
      fontStyle: c.muted ? 'italic' : 'normal',
      fontWeight: emphasis ? 600 : 400,
    }}>
      {c.text}
    </td>
  );
}

function DeltaCell({ d, metric, kind, borderTop }: { d: PickupDelta | undefined; metric: PickupMetric; kind: 'abs' | 'pct'; borderTop: string }) {
  const c = deltaCell(d, metric, kind);
  // Tinted background only — no chip border, no fill change on tone='mute'.
  const bg = c.tone === 'good' ? '#E8F2E4' : c.tone === 'bad' ? '#F7E2DC' : 'transparent';
  const fg = c.tone === 'good' ? '#1F3A2E' : c.tone === 'bad' ? '#8A2A1D' : INK_SOFT;
  return (
    <td style={{ ...S.td, borderTop, background: bg, color: fg, fontStyle: c.tone === 'mute' ? 'italic' : 'normal' }}>
      {c.text}
    </td>
  );
}

const S: Record<string, CSSProperties> = {
  scroll: {
    overflowX: 'auto',
    border: `1px solid ${HAIRLINE}`,
    borderRadius: 4,
    background: PAPER,
  },
  table: {
    borderCollapse: 'separate',
    borderSpacing: 0,
    width: '100%',
    minWidth: 1280,
    fontFamily: 'inherit',
    fontSize: 10,
    background: PAPER,
    lineHeight: 1.2,
  },
  groupTh: {
    padding: '6px 10px',
    textAlign: 'center',
    color: INK,
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    background: PAPER,
    borderBottom: `2px solid ${BLOCK_RULE}`,
    borderRight: `1px solid ${HAIRLINE}`,
  },
  headerTh: {
    padding: '5px 8px',
    textAlign: 'right',
    color: INK,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.02em',
    background: PAPER,
    borderBottom: `1px solid ${HAIRLINE}`,
    borderRight: `1px solid ${HAIRLINE}`,
    whiteSpace: 'nowrap',
  },
  headerSub: {
    fontSize: 10,
    fontWeight: 500,
    color: INK,
    marginTop: 1,
  },
  rowHead: {
    padding: '2px 6px',
    textAlign: 'left',
    minWidth: 64,
    width: 64,
    maxWidth: 64,
    borderRight: `1px solid ${HAIRLINE}`,
    color: INK,
    verticalAlign: 'middle',
  },
  td: {
    padding: '2px 4px',
    textAlign: 'right',
    borderRight: `1px solid ${HAIRLINE}`,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    height: 18,
    maxWidth: 56,
    minWidth: 44,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: INK,
    letterSpacing: '0.04em',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: 500,
    color: INK_SOFT,
    letterSpacing: '0.04em',
  },
  frozen: { position: 'sticky', left: 0, zIndex: 1 },
  frozenHead: { zIndex: 3, top: 0 },
};
