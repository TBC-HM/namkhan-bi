// app/(cockpit)/_design/PickupMatrix.tsx
// Monthly pickup matrix primitive — fully on the paper palette now (no dark
// header bands, no hard black frame). Row labels are dark on paper; group
// header is cream-on-ink so it reads at a glance. Null cells render "—" so
// the table is meaningful before snapshot / budget / 2023-24 sources land.

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

interface Props {
  data: PickupMatrixData;
}

const fmtInt   = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtUsd   = (n: number) => '€' + Math.round(n).toLocaleString('en-US');
const fmtPct   = (n: number) => `${n.toFixed(1)}%`;
const fmtDelta = (n: number, asPct: boolean) => (n >= 0 ? '+' : '') + (asPct ? fmtPct(n) : fmtInt(n));

function fmtMetric(metric: PickupMetric, val: number): string {
  if (metric === 'OCC') return fmtPct(val);
  if (metric === 'RN')  return fmtInt(val);
  return fmtUsd(val);
}

function cell(val: number | null, metric: PickupMetric): { text: string; muted: boolean } {
  if (val == null || !Number.isFinite(val)) return { text: '—', muted: true };
  return { text: fmtMetric(metric, val), muted: false };
}

function deltaCell(d: PickupDelta | undefined, metric: PickupMetric, kind: 'abs' | 'pct') {
  const raw = kind === 'abs' ? d?.abs : d?.pct;
  if (raw == null || !Number.isFinite(raw)) return { text: '—', tone: 'mute' as const };
  const positive = raw >= 0;
  const text = kind === 'abs' ? fmtDelta(raw, false) + (metric === 'OCC' ? 'pp' : '') : fmtDelta(raw, true);
  const tone = raw === 0 ? 'mute' : positive ? 'good' : 'bad';
  return { text, tone };
}

export default function PickupMatrix({ data }: Props) {
  return (
    <div style={S.scroll}>
      <table style={S.table}>
        <thead>
          <tr style={S.groupRow}>
            <th style={{ ...S.groupTh, ...S.frozen, ...S.frozenHead, background: '#EFE9D6', color: 'var(--ink, #1B1B1B)', textAlign: 'left' }}>
              {data.asOfDate}
              {data.stalenessNote && (
                <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--ink-soft, #5A5A5A)', marginTop: 2, fontStyle: 'italic' }}>{data.stalenessNote}</div>
              )}
            </th>
            <th style={S.groupTh} colSpan={4}>Baselines</th>
            <th style={S.groupTh} colSpan={5}>OTB snapshots</th>
            <th style={S.groupTh} colSpan={3}>Pickup</th>
            <th style={S.groupTh} colSpan={4}>Comparison</th>
            <th style={S.groupTh} colSpan={2}>SDLY {data.sdlyDate}</th>
          </tr>
          <tr style={S.headerRow}>
            <th style={{ ...S.headerTh, ...S.frozen, ...S.frozenHead, background: '#F7F1DF', textAlign: 'left' }}>Month · Metric</th>
            <th style={S.headerTh}>2023 RO</th>
            <th style={S.headerTh}>2024 RO</th>
            <th style={S.headerTh}>2025 RO</th>
            <th style={S.headerTh}>Budget 2026</th>
            <th style={S.headerTh}>OTB ALL 2026</th>
            <th style={S.headerTh}>Monthly<br/><span style={S.headerSub}>{data.monthlySnapshotLabel}</span></th>
            <th style={S.headerTh}>Monday<br/><span style={S.headerSub}>{data.mondaySnapshotLabel}</span></th>
            <th style={S.headerTh}>Yesterday<br/><span style={S.headerSub}>{data.yesterdaySnapshotLabel}</span></th>
            <th style={S.headerTh}>Today<br/><span style={S.headerSub}>{data.todaySnapshotLabel}</span></th>
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
  const bg = isTotal ? '#F7F1DF' : isAlt ? '#FAF8F1' : '#FFFFFF';
  return (
    <>
      {month.rows.map((r, i) => {
        const showMonth = i === 0;
        return (
          <tr key={`${month.monthKey}-${r.metric}`} style={{ background: bg, borderTop: showMonth ? '1px solid #D8CFB7' : '1px solid #F2EBD8' }}>
            <th style={{ ...S.rowHead, ...S.frozen, background: bg, fontWeight: isTotal ? 700 : 500 }}>
              {showMonth && (
                <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.04em', marginBottom: 1 }}>
                  {month.monthLabel}
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>{r.metric}</div>
            </th>
            <Cell val={r.baseline2023} metric={r.metric} />
            <Cell val={r.baseline2024} metric={r.metric} />
            <Cell val={r.baseline2025} metric={r.metric} />
            <Cell val={r.budget2026}   metric={r.metric} />
            <Cell val={r.otbAll}       metric={r.metric} emphasis />
            <Cell val={r.otbMonthly}   metric={r.metric} />
            <Cell val={r.otbMonday}    metric={r.metric} />
            <Cell val={r.otbYesterday} metric={r.metric} />
            <Cell val={r.otbToday}     metric={r.metric} emphasis />
            <DeltaCell d={r.pickupMonthly}   metric={r.metric} kind="abs" />
            <DeltaCell d={r.pickupWeekly}    metric={r.metric} kind="abs" />
            <DeltaCell d={r.pickupYesterday} metric={r.metric} kind="abs" />
            <DeltaCell d={r.vsBudget} metric={r.metric} kind="abs" />
            <DeltaCell d={r.vsBudget} metric={r.metric} kind="pct" />
            <DeltaCell d={r.vsLy}     metric={r.metric} kind="abs" />
            <DeltaCell d={r.vsLy}     metric={r.metric} kind="pct" />
            <Cell val={r.sdly}     metric={r.metric} />
            <DeltaCell d={{ abs: r.sdlyDiff, pct: null }} metric={r.metric} kind="abs" />
          </tr>
        );
      })}
    </>
  );
}

function Cell({ val, metric, emphasis }: { val: number | null; metric: PickupMetric; emphasis?: boolean }) {
  const c = cell(val, metric);
  return (
    <td style={{
      ...S.td,
      color: c.muted ? 'var(--ink-soft, #8A8276)' : 'var(--ink, #1B1B1B)',
      fontStyle: c.muted ? 'italic' : 'normal',
      fontWeight: emphasis ? 600 : 400,
    }}>
      {c.text}
    </td>
  );
}

function DeltaCell({ d, metric, kind }: { d: PickupDelta | undefined; metric: PickupMetric; kind: 'abs' | 'pct' }) {
  const c = deltaCell(d, metric, kind);
  const bg = c.tone === 'good' ? '#E8F2E4' : c.tone === 'bad' ? '#F7E2DC' : 'transparent';
  const fg = c.tone === 'good' ? '#1F3A2E' : c.tone === 'bad' ? '#8A2A1D' : 'var(--ink-soft, #8A8276)';
  return (
    <td style={{ ...S.td, background: bg, color: fg, fontStyle: c.tone === 'mute' ? 'italic' : 'normal' }}>
      {c.text}
    </td>
  );
}

const S: Record<string, CSSProperties> = {
  scroll: {
    overflowX: 'auto',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 6,
    background: 'var(--paper, #FFFFFF)',
  },
  table: {
    borderCollapse: 'separate',
    borderSpacing: 0,
    width: '100%',
    minWidth: 1600,
    fontFamily: 'inherit',
    fontSize: 11,
  },
  groupRow: { background: '#EFE9D6' },
  groupTh: {
    padding: '8px 10px',
    textAlign: 'center',
    color: 'var(--ink, #1B1B1B)',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderRight: '1px solid #E6DFCC',
    borderBottom: '1px solid #D8CFB7',
    background: '#EFE9D6',
  },
  headerRow: { background: '#F7F1DF' },
  headerTh: {
    padding: '6px 8px',
    textAlign: 'right',
    color: 'var(--ink-soft, #5A5A5A)',
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.04em',
    background: '#F7F1DF',
    borderBottom: '1px solid #D8CFB7',
    borderRight: '1px solid #E6DFCC',
    whiteSpace: 'nowrap',
  },
  headerSub: { fontSize: 9, fontWeight: 400, color: 'var(--ink-soft, #5A5A5A)' },
  rowHead: {
    padding: '6px 10px',
    textAlign: 'left',
    minWidth: 140,
    borderRight: '1px solid #E6DFCC',
    color: 'var(--ink, #1B1B1B)',
  },
  td: {
    padding: '5px 8px',
    textAlign: 'right',
    borderRight: '1px solid #F2EBD8',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  frozen: { position: 'sticky', left: 0, zIndex: 1 },
  frozenHead: { zIndex: 2 },
};
