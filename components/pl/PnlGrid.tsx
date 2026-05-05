'use client';

// components/pl/PnlGrid.tsx
//
// 12-month P&L grid for Operations sub-pages (Restaurant, Spa, Activities, Retail).
// Reads from `lib/data.getDeptPl()`. Columns: month + revenue (split for F&B
// into Food rev + Bev rev), COGS lines, payroll, other OE, GOP $/% — coloured
// against USALI targets.
//
// USALI targets per dept (configurable here, single source of truth):
//   F&B  : food cost ≤ 30%, bev cost ≤ 25%, labor ≤ 35%, GOP ≥ 25%
//   Spa  : spa cost ≤ 12%,  labor ≤ 35%, GOP ≥ 50%
//   Activities, Retail : labor ≤ 40%, GOP ≥ 35%
//
// Collapsible: by default shows the most recent `defaultRows` rows. Toggle
// expands to the full window passed in (typically 12–16 months).

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { DeptPlRow } from '@/lib/data';

export interface PlTargets {
  food_cost_pct?: number;
  bev_cost_pct?: number;
  spa_cost_pct?: number;
  labor_cost_pct: number;
  gop_pct: number;
}

interface Props {
  rows: DeptPlRow[];          // sorted descending by period
  dept: 'fnb' | 'spa' | 'activities' | 'retail';
  targets: PlTargets;
  /** How many rows to show before the user clicks "Show full history". Default 6. */
  defaultRows?: number;
}

export default function PnlGrid({ rows, dept, targets, defaultRows = 6 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = rows.length > defaultRows;
  const visible = expanded || !collapsible ? rows : rows.slice(0, defaultRows);

  // Format month label "Apr '26"
  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split('-').map(Number);
    if (!y || !m) return yyyymm;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  };

  // Tone helpers
  const pctTone = (val: number, target: number, rev: number, lower_is_better = true): string => {
    if (rev <= 0) return 'muted';
    if (lower_is_better) return val <= target ? 'pos' : val <= target * 1.15 ? 'warn' : 'neg';
    return val >= target ? 'pos' : val >= target * 0.85 ? 'warn' : 'neg';
  };
  const toneStyle = (t: string): CSSProperties => ({
    color:
      t === 'pos'  ? 'var(--good, #2c7a4b)' :
      t === 'warn' ? 'var(--warn, #b48228)' :
      t === 'neg'  ? 'var(--bad, #b53a2a)'  :
                     'var(--ink-soft, #6b675f)',
    fontVariantNumeric: 'tabular-nums',
  });

  const fmtMoney = (n: number) => {
    if (n === 0) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  };
  const fmtPct = (n: number) => (n === 0 ? '—' : `${n.toFixed(1)}%`);

  // Total column count for empty-state colspan
  const colCount =
    1 /* Month */ +
    (dept === 'fnb' ? 3 : 1) /* Revenue split */ +
    (dept === 'fnb' ? 4 : dept === 'spa' ? 2 : 0) /* cost-of-sales lines */ +
    6 /* Payroll, Labor%, Other OE, GOP$, GOP%, CB rev, CB↔QB */;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 'var(--t-sm)',
      }}>
        <thead>
          <tr>
            {[
              { l: 'Month', a: 'left' as const },
              ...(dept === 'fnb'
                ? [
                    { l: 'Total rev',  a: 'right' as const },
                    { l: 'Food rev',   a: 'right' as const },
                    { l: 'Bev rev',    a: 'right' as const },
                  ]
                : [{ l: 'Revenue', a: 'right' as const }]),
              ...(dept === 'fnb'
                ? [
                    { l: 'Food cost', a: 'right' as const }, { l: 'Food %', a: 'right' as const },
                    { l: 'Bev cost',  a: 'right' as const }, { l: 'Bev %',  a: 'right' as const },
                  ]
                : dept === 'spa'
                ? [
                    { l: 'Spa cost', a: 'right' as const }, { l: 'Spa %',  a: 'right' as const },
                  ]
                : []),
              { l: 'Payroll',  a: 'right' as const },
              { l: 'Labor %',  a: 'right' as const },
              { l: 'Other OE', a: 'right' as const },
              { l: 'GOP $',    a: 'right' as const },
              { l: 'GOP %',    a: 'right' as const },
              { l: 'CB rev',   a: 'right' as const },
              { l: 'CB↔QB',    a: 'right' as const },
            ].map((c, i) => (
              <th key={i} style={{
                textAlign: c.a,
                padding: '8px 10px',
                borderBottom: '1px solid var(--rule, #e3dfd3)',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                color: 'var(--brass)',
                fontWeight: 500,
              }}>{c.l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={colCount} style={{ padding: 16, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                No P&amp;L data for this window. Check QB upload + matview refresh (cron 37).
              </td>
            </tr>
          ) : visible.map((r) => {
            const cell: CSSProperties = {
              padding: '6px 10px',
              borderBottom: '1px solid var(--rule, #e3dfd3)',
              textAlign: 'right',
            };
            const cellL: CSSProperties = { ...cell, textAlign: 'left' };
            const gopT  = pctTone(r.gop_pct,        targets.gop_pct,        r.revenue, false);
            const labT  = pctTone(r.labor_cost_pct, targets.labor_cost_pct, r.revenue, true);
            const foodT = pctTone(r.food_cost_pct,  targets.food_cost_pct ?? 999, r.revenue, true);
            const bevT  = pctTone(r.bev_cost_pct,   targets.bev_cost_pct ?? 999,  r.revenue, true);
            const spaT  = pctTone(r.spa_cost_pct,   targets.spa_cost_pct ?? 999,  r.revenue, true);
            const reconT =
              r.cb_qb_variance_pct == null
                ? 'muted'
                : Math.abs(r.cb_qb_variance_pct) <= 5
                ? 'pos'
                : Math.abs(r.cb_qb_variance_pct) <= 10
                ? 'warn'
                : 'neg';
            return (
              <tr key={r.period}>
                <td style={cellL}>{monthLabel(r.period)}</td>
                {dept === 'fnb' ? (
                  <>
                    <td style={cell}>{fmtMoney(r.revenue)}</td>
                    <td style={cell}>{fmtMoney(r.food_revenue)}</td>
                    <td style={cell}>{fmtMoney(r.bev_revenue)}</td>
                    <td style={cell}>{fmtMoney(r.food_cost)}</td>
                    <td style={{ ...cell, ...toneStyle(foodT) }}>{fmtPct(r.food_cost_pct)}</td>
                    <td style={cell}>{fmtMoney(r.bev_cost)}</td>
                    <td style={{ ...cell, ...toneStyle(bevT) }}>{fmtPct(r.bev_cost_pct)}</td>
                  </>
                ) : (
                  <td style={cell}>{fmtMoney(r.revenue)}</td>
                )}
                {dept === 'spa' && (
                  <>
                    <td style={cell}>{fmtMoney(r.spa_cost)}</td>
                    <td style={{ ...cell, ...toneStyle(spaT) }}>{fmtPct(r.spa_cost_pct)}</td>
                  </>
                )}
                <td style={cell}>{fmtMoney(r.payroll)}</td>
                <td style={{ ...cell, ...toneStyle(labT) }}>{fmtPct(r.labor_cost_pct)}</td>
                <td style={cell}>{fmtMoney(r.other_oe)}</td>
                <td style={{ ...cell, ...toneStyle(r.gop < 0 ? 'neg' : r.gop > 0 ? 'pos' : 'muted') }}>{fmtMoney(r.gop)}</td>
                <td style={{ ...cell, ...toneStyle(gopT) }}>{fmtPct(r.gop_pct)}</td>
                <td style={cell}>{r.cb_revenue == null ? '—' : fmtMoney(r.cb_revenue)}</td>
                <td style={{ ...cell, ...toneStyle(reconT) }}>
                  {r.cb_qb_variance_pct == null ? '—' : `${r.cb_qb_variance_pct > 0 ? '+' : ''}${r.cb_qb_variance_pct.toFixed(0)}%`}
                </td>
              </tr>
            );
          })}
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
              ? `Show last ${defaultRows} months ▴`
              : `Show full history (${rows.length} months) ▾`}
          </button>
        </div>
      )}
    </div>
  );
}
