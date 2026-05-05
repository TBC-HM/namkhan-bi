'use client';

// components/pl/FnbTopSellerTrend.tsx
//
// Replaces the static "deadfish" top-sellers table on /operations/restaurant.
// One row per item: name, sparkline (revenue per month since startIso), total
// revenue, units, Jan→latest delta %. Sort by total revenue desc.

import type { CSSProperties } from 'react';
import type { TopSellerTrend } from '@/lib/data';

interface Props {
  data: { periods: string[]; items: TopSellerTrend[] };
}

export default function FnbTopSellerTrend({ data }: Props) {
  const { periods, items } = data;
  if (items.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
        No F&amp;B transactions in window.
      </div>
    );
  }

  const fmtMoney = (n: number) => {
    if (!n || n === 0) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  };
  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split('-').map(Number);
    if (!y || !m) return yyyymm;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short' });
  };

  const cell: CSSProperties = {
    padding: '6px 10px',
    borderBottom: '1px solid var(--rule, #e3dfd3)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  };
  const cellL: CSSProperties = { ...cell, textAlign: 'left' };

  // SVG sparkline maker
  const sparkW = 120;
  const sparkH = 28;
  function sparkline(monthly: TopSellerTrend['monthly']) {
    const max = Math.max(...monthly.map((m) => m.revenue), 1);
    const dx = monthly.length > 1 ? sparkW / (monthly.length - 1) : sparkW;
    const points = monthly
      .map((m, i) => `${(i * dx).toFixed(1)},${(sparkH - (m.revenue / max) * sparkH).toFixed(1)}`)
      .join(' ');
    const lastIdx = monthly.length - 1;
    const lastY = sparkH - (monthly[lastIdx].revenue / max) * sparkH;
    return (
      <svg width={sparkW} height={sparkH} style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke="var(--brass, #b48228)"
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastIdx * dx} cy={lastY} r={2} fill="var(--brass, #b48228)" />
      </svg>
    );
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
            {[
              { l: 'Item', a: 'left' as const },
              { l: `Trend (${periods.length > 0 ? `${monthLabel(periods[0])}→${monthLabel(periods[periods.length - 1])}` : '—'})`, a: 'left' as const },
              { l: 'Total rev', a: 'right' as const },
              { l: 'Avg / mo', a: 'right' as const },
              { l: 'Last sold', a: 'right' as const },
              { l: 'Months active', a: 'right' as const },
              { l: 'POS lines', a: 'right' as const },
              { l: 'Margin %', a: 'right' as const },
              { l: 'Δ first→latest', a: 'right' as const },
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
          {items.map((it) => {
            const tone =
              it.delta_pct == null  ? 'muted' :
              it.delta_pct >  10    ? 'pos'   :
              it.delta_pct < -10    ? 'neg'   :
                                       'muted';
            const tStyle: CSSProperties = {
              color:
                tone === 'pos' ? 'var(--good, #2c7a4b)' :
                tone === 'neg' ? 'var(--bad, #b53a2a)' :
                                 'var(--ink-soft, #6b675f)',
              fontVariantNumeric: 'tabular-nums',
            };
            return (
              <tr key={it.description}>
                <td style={cellL}><strong>{it.description}</strong></td>
                <td style={cellL}>{sparkline(it.monthly)}</td>
                <td style={cell}>{fmtMoney(it.total_revenue_usd)}</td>
                <td style={cell}>{fmtMoney(it.avg_rev_per_active_month)}</td>
                <td style={cell}>{it.last_sold ?? '—'}</td>
                <td style={cell}>{it.active_months}</td>
                <td style={cell}>{it.total_units}</td>
                <td style={{ ...cell, color: 'var(--ink-soft)' }}>—</td>
                <td style={{ ...cell, ...tStyle }}>
                  {it.delta_pct == null
                    ? '—'
                    : `${it.delta_pct > 0 ? '+' : ''}${it.delta_pct.toFixed(0)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
