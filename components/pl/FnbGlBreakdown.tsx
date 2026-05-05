'use client';

// components/pl/FnbGlBreakdown.tsx
//
// Wide table: one row per (USALI subcategory + raw QB account_name),
// one column per month. Reads from `lib/data.getFnbGlBreakdown()`.
// Used on /operations/restaurant to expose accounts the rolled-up grid hides
// (Staff Canteen Materials, Employee Meal, Animal Food, Maintenance, etc.).
//
// Collapsible: by default shows the latest 4 months. Toggle expands to the
// full window (typically 16 months).

import { useState, type CSSProperties } from 'react';
import type { FnbGlBreakdown as Data, FnbGlLine } from '@/lib/data';

interface Props {
  data: Data;
  /** How many months to show before "Show full history". Default 4. */
  defaultMonths?: number;
}

export default function FnbGlBreakdown({ data, defaultMonths = 4 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = data.periods.length > defaultMonths;
  const visiblePeriods = expanded || !collapsible
    ? data.periods
    : data.periods.slice(0, defaultMonths);

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

  const cell: CSSProperties = {
    padding: '6px 10px',
    borderBottom: '1px solid var(--rule, #e3dfd3)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  };
  const cellL: CSSProperties = { ...cell, textAlign: 'left' };
  const subHead: CSSProperties = {
    background: 'rgba(180, 130, 40, 0.06)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass)',
    padding: '6px 10px',
  };

  // Group lines by USALI subcategory in the table
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
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 'var(--t-sm)',
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderBottom: '1px solid var(--rule, #e3dfd3)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              fontWeight: 500,
              minWidth: 240,
            }}>QB Account</th>
            {visiblePeriods.map((p) => (
              <th key={p} style={{
                textAlign: 'right',
                padding: '8px 10px',
                borderBottom: '1px solid var(--rule, #e3dfd3)',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                color: 'var(--brass)',
                fontWeight: 500,
              }}>{monthLabel(p)}</th>
            ))}
            <th style={{
              textAlign: 'right',
              padding: '8px 10px',
              borderBottom: '1px solid var(--rule, #e3dfd3)',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              fontWeight: 500,
            }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={visiblePeriods.length + 2} style={{ padding: 16, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                No F&amp;B GL lines in window. Check QB upload.
              </td>
            </tr>
          ) : groups.map((g) => (
            <>
              <tr key={`head-${g.sub}`}>
                <td style={subHead} colSpan={visiblePeriods.length + 2}>{g.sub}</td>
              </tr>
              {g.lines.map((line) => (
                <tr key={`${g.sub}-${line.account_name}`}>
                  <td style={{ ...cellL, paddingLeft: 24 }}>{line.account_name}</td>
                  {visiblePeriods.map((p) => (
                    <td key={p} style={cell}>{fmtMoney(line.amounts_by_period[p] ?? 0)}</td>
                  ))}
                  <td style={{ ...cell, fontWeight: 600 }}>{fmtMoney(line.total_usd)}</td>
                </tr>
              ))}
              <tr key={`sub-${g.sub}`}>
                <td style={{ ...cellL, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>
                  Subtotal · {g.sub}
                </td>
                {visiblePeriods.map((p) => (
                  <td key={p} style={{ ...cell, fontWeight: 600 }}>{fmtMoney(g.subTotalByPeriod[p] ?? 0)}</td>
                ))}
                <td style={{ ...cell, fontWeight: 700 }}>{fmtMoney(g.subTotal)}</td>
              </tr>
            </>
          ))}
        </tbody>
      </table>

      {collapsible && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'transparent',
              border: 0,
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
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
