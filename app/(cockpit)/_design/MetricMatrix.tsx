// app/(cockpit)/_design/MetricMatrix.tsx
// PBS 2026-08-26 · Generic metrics-down / periods-across table.
//
// Extracted from the Revenue HoD headline matrix (3c26c638) so the CEO
// heartbeat does not hand-roll a second copy — design_system §1 makes
// reinventing a container per page a constitutional violation.
//
// This renders SHAPE only: the caller formats every value and picks the tone.
// No fetching, no maths, no currency logic.

import type { CSSProperties, ReactNode } from 'react';
import './internal/tokens.css';

const HAIRLINE = 'var(--hairline, #E6DFCC)';
const INK      = 'var(--ink, #1B1B1B)';
const INK_SOFT = 'var(--ink-soft, #5A5A5A)';

export type MatrixTone = 'pos' | 'neg' | 'warn' | 'mute';

const TONE: Record<MatrixTone, string> = {
  pos:  'var(--status-green, #1F5C2C)',
  neg:  'var(--status-red, #B04A2F)',
  warn: 'var(--status-amber, #B47A1F)',
  mute: INK_SOFT,
};

export interface MatrixColumn {
  key: string;
  label: string;
  /** small second line under the column head — e.g. a date range */
  sub?: string;
}

export interface MatrixCell {
  value: ReactNode;
  tone?: MatrixTone;
  /** small line under the value — LY pill, prior-year figure, share */
  sub?: string;
  /** 0..100 — draws a proportional rule under the value */
  bar?: number;
  /** native hover tooltip carrying the per-cell detail */
  title?: string;
}

export interface MatrixRow {
  key: string;
  label: string;
  /** small line under the row label — the unit or definition */
  unit?: string;
  cells: Record<string, MatrixCell | undefined>;
}

export interface MetricMatrixProps {
  columns: MatrixColumn[];
  rows: MatrixRow[];
  /** accessible summary — required, the table is data */
  caption: string;
  minWidth?: number;
  /** width of the row-label column; widen for long metric names */
  labelWidth?: number;
}

export default function MetricMatrix({
  columns, rows, caption, minWidth = 520, labelWidth = 156,
}: MetricMatrixProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ ...S.table, minWidth }}>
        <caption style={S.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" style={{ ...S.rowh, ...S.head, width: labelWidth }}>
              <span style={S.srOnly}>Metric</span>
            </th>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={S.head}>
                {c.label}
                {c.sub && <span style={S.headSub}>{c.sub}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" style={{ ...S.rowh, width: labelWidth }}>
                {r.label}
                {r.unit && <span style={S.unit}>{r.unit}</span>}
              </th>
              {columns.map((c) => {
                const cell = r.cells[c.key];
                if (!cell) {
                  // Dormant, not zero: the slot stays visible and fills in
                  // when the data lands.
                  return <td key={c.key} style={S.td}><span style={S.empty}>—</span></td>;
                }
                return (
                  <td key={c.key} style={S.td} title={cell.title}>
                    <span style={{
                      ...S.value,
                      color: cell.tone ? TONE[cell.tone] : INK,
                      cursor: cell.title ? 'help' : 'default',
                    }}>
                      {cell.value}
                    </span>
                    {typeof cell.bar === 'number' && (
                      <span style={S.bar} aria-hidden="true">
                        <span style={{
                          ...S.barFill,
                          width: `${Math.max(0, Math.min(100, cell.bar))}%`,
                          background: cell.tone ? TONE[cell.tone] : 'var(--primary, #1F3A2E)',
                        }} />
                      </span>
                    )}
                    {cell.sub && <span style={S.sub}>{cell.sub}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  srOnly: {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  head: {
    fontSize: 10, letterSpacing: '0.055em', textTransform: 'uppercase',
    fontWeight: 600, color: INK_SOFT, textAlign: 'right',
    borderBottom: `1px solid ${HAIRLINE}`, padding: '0 10px 5px', verticalAlign: 'bottom',
  },
  headSub: {
    display: 'block', fontSize: 9, letterSpacing: '0.01em', textTransform: 'none',
    fontWeight: 400, color: INK_SOFT, opacity: 0.8, marginTop: 1,
  },
  rowh: {
    textAlign: 'left', paddingLeft: 0, paddingRight: 10,
    fontWeight: 500, fontSize: 12.5, color: INK, verticalAlign: 'baseline',
  },
  unit: {
    display: 'block', fontSize: 9.5, fontWeight: 400, color: INK_SOFT,
    letterSpacing: '0.01em', lineHeight: 1.3,
  },
  td: {
    textAlign: 'right', padding: '8px 10px', verticalAlign: 'baseline',
    borderTop: `1px solid ${HAIRLINE}`,
  },
  value: {
    fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em',
    display: 'inline-block',
  },
  empty: { color: INK_SOFT, fontSize: 13, opacity: 0.7 },
  sub: { display: 'block', fontSize: 10, color: INK_SOFT, marginTop: 1, whiteSpace: 'nowrap' },
  bar: {
    // PBS 2026-08-26: was the tan hairline, which read brown down a whole
    // column. Neutral track; the fill still carries the tone.
    display: 'block', height: 3, borderRadius: 2, background: 'rgba(27,27,27,0.10)',
    marginTop: 4, position: 'relative', overflow: 'hidden',
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
};
