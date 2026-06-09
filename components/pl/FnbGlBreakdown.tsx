'use client';

// components/pl/FnbGlBreakdown.tsx
// PBS 2026-06-09 #172 — rebuilt B&W. Drops the legacy QB-export table aesthetic.
// One row per (USALI subcategory + raw QB account_name), one column per month.
// Reads from `lib/data.getFnbGlBreakdown()`. Used on /operations/restaurant.

import { useState, type CSSProperties } from 'react';
import type { FnbGlBreakdown as Data, FnbGlLine } from '@/lib/data';

interface Props {
  data: Data;
  /** How many months to show before "Show full history". Default 4. */
  defaultMonths?: number;
}

const INK = '#000';
const INK_MUTED = '#5A5A5A';
const HAIRLINE = '#E0E0E0';
const HAIRLINE_SOFT = '#F0F0F0';
const HOVER = '#FAFAFA';
const SECTION_BG = '#F5F5F5';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export default function FnbGlBreakdown({ data, defaultMonths = 6 }: Props) {
  const [expanded, setExpanded] = useState(false);
  // PBS #174 — sort chronologically ascending (Jan first), default 6 columns visible, expand reveals all.
  const sortedPeriods = [...data.periods].sort((a, b) => a.localeCompare(b));
  const collapsible = sortedPeriods.length > defaultMonths;
  const visiblePeriods = expanded || !collapsible
    ? sortedPeriods
    : sortedPeriods.slice(-defaultMonths);

  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split('-').map(Number);
    if (!y || !m) return yyyymm;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  };
  const fmtMoney = (n: number) => {
    if (!n || n === 0) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  };

  const th: CSSProperties = {
    textAlign: 'right',
    padding: '8px 10px',
    borderBottom: `1px solid ${INK}`,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: INK_MUTED,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  };
  const thL: CSSProperties = { ...th, textAlign: 'left', minWidth: 220 };
  const td: CSSProperties = {
    padding: '6px 10px',
    borderBottom: `1px solid ${HAIRLINE_SOFT}`,
    textAlign: 'right',
    fontFamily: MONO,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    color: INK,
    whiteSpace: 'nowrap',
  };
  const tdL: CSSProperties = { ...td, textAlign: 'left', fontFamily: 'inherit', color: INK };
  const sectionRow: CSSProperties = {
    background: SECTION_BG,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: INK,
    padding: '8px 10px',
    borderTop: `1px solid ${HAIRLINE}`,
    borderBottom: `1px solid ${HAIRLINE}`,
  };
  const subtotalRow: CSSProperties = {
    ...td,
    fontWeight: 700,
    borderTop: `1px solid ${HAIRLINE}`,
    borderBottom: `2px solid ${INK}`,
    background: '#FFFFFF',
  };

  // Group lines by USALI subcategory
  const groups: { sub: string; lines: FnbGlLine[]; subTotalByPeriod: Record<string, number>; subTotal: number }[] = [];
  const seen = new Set<string>();
  for (const line of data.lines) {
    if (seen.has(line.usali_subcategory)) continue;
    seen.add(line.usali_subcategory);
    const groupLines = data.lines.filter((l) => l.usali_subcategory === line.usali_subcategory);
    const subTotalByPeriod: Record<string, number> = {};
    let subTotal = 0;
    for (const gl of groupLines) {
      for (const [p, v] of Object.entries(gl.amounts_by_period)) {
        subTotalByPeriod[p] = (subTotalByPeriod[p] ?? 0) + v;
      }
      subTotal += gl.total_usd;
    }
    groups.push({ sub: line.usali_subcategory, lines: groupLines, subTotalByPeriod, subTotal });
  }

  return (
    <div style={{ overflowX: 'auto', background: '#FFFFFF' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
      }}>
        <thead>
          <tr>
            <th style={thL}>QB Account</th>
            {visiblePeriods.map((p) => (
              <th key={p} style={th}>{monthLabel(p)}</th>
            ))}
            <th style={th}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={visiblePeriods.length + 2} style={{ padding: 24, color: INK_MUTED, fontStyle: 'italic', textAlign: 'center', fontSize: 12 }}>
                No F&amp;B GL lines in window — check QB upload.
              </td>
            </tr>
          ) : groups.map((g) => (
            <>
              <tr key={`head-${g.sub}`}>
                <td style={sectionRow} colSpan={visiblePeriods.length + 2}>{g.sub}</td>
              </tr>
              {g.lines.map((line) => (
                <tr key={`${g.sub}-${line.account_name}`}
                    style={{ transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...tdL, paddingLeft: 22 }}>{line.account_name}</td>
                  {visiblePeriods.map((p) => (
                    <td key={p} style={td}>{fmtMoney(line.amounts_by_period[p] ?? 0)}</td>
                  ))}
                  <td style={{ ...td, fontWeight: 600 }}>{fmtMoney(line.total_usd)}</td>
                </tr>
              ))}
              <tr key={`sub-${g.sub}`}>
                <td style={{ ...subtotalRow, textAlign: 'left', fontFamily: 'inherit', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
                  Subtotal · {g.sub}
                </td>
                {visiblePeriods.map((p) => (
                  <td key={p} style={subtotalRow}>{fmtMoney(g.subTotalByPeriod[p] ?? 0)}</td>
                ))}
                <td style={{ ...subtotalRow, fontWeight: 700 }}>{fmtMoney(g.subTotal)}</td>
              </tr>
            </>
          ))}
        </tbody>
      </table>

      {collapsible && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, padding: '0 4px' }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'transparent',
              border: `1px solid ${HAIRLINE}`,
              padding: '6px 12px',
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: INK,
              borderRadius: 4,
            }}
          >
            {expanded
              ? `Show last ${defaultMonths} months ▴`
              : `Show full history (${data.periods.length} months) ▾`}
          </button>
        </div>
      )}
    </div>
  );
}
