'use client';

// components/pl/FnbTopSellerTrend.tsx
// PBS 2026-06-09 #173 — full B&W rebuild + Food/Drink/All segment toggle + Top 10 collapsed default.

import { useState, useMemo, type CSSProperties } from 'react';
import type { TopSellerTrend } from '@/lib/data';

interface Props {
  data: { periods: string[]; items: TopSellerTrend[] };
  /** When true (Spa/Activities), suppress the All/Food/Drink/Minibar pill row. */
  hideSegments?: boolean;
}

const INK = '#000';
const INK_MUTED = '#5A5A5A';
const HAIRLINE = '#E0E0E0';
const HAIRLINE_SOFT = '#F0F0F0';
const HOVER = '#FAFAFA';
const GOOD = '#1c4d3a';
const BAD = '#8e3a35';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

type Segment = 'all' | 'food' | 'drink' | 'minibar';

export default function FnbTopSellerTrend({ data, hideSegments = false }: Props) {
  const [segment, setSegment] = useState<Segment>('all');
  const [expanded, setExpanded] = useState(false);
  const { periods, items } = data;

  const filtered = useMemo(() => {
    if (segment === 'all') return items;
    return items.filter((it) => {
      const sd = (it.usali_subdept ?? '').toLowerCase();
      if (segment === 'food')    return sd === 'food';
      if (segment === 'drink')   return sd === 'beverage';
      if (segment === 'minibar') return sd === 'minibar';
      return false;
    });
  }, [items, segment]);

  const visible = expanded ? filtered : filtered.slice(0, 10);
  const collapsible = filtered.length > 10;

  if (items.length === 0) {
    return (
      <div style={{ padding: 24, color: INK_MUTED, fontStyle: 'italic', textAlign: 'center', fontSize: 12 }}>
        No F&amp;B transactions in window.
      </div>
    );
  }

  const fmtMoney = (n: number) => {
    if (!n || n === 0) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  };
  const monthLabel = (yyyymm: string) => {
    const [y, m] = yyyymm.split('-').map(Number);
    if (!y || !m) return yyyymm;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short' });
  };

  const th: CSSProperties = {
    textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${INK}`,
    fontFamily: MONO, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: INK_MUTED, fontWeight: 500, whiteSpace: 'nowrap',
  };
  const thL: CSSProperties = { ...th, textAlign: 'left' };
  const td: CSSProperties = {
    padding: '8px 10px', borderBottom: `1px solid ${HAIRLINE_SOFT}`, textAlign: 'right',
    fontFamily: MONO, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: INK, whiteSpace: 'nowrap',
  };
  const tdL: CSSProperties = { ...td, textAlign: 'left', fontFamily: 'inherit' };

  const sparkW = 100;
  const sparkH = 24;
  function sparkline(monthly: TopSellerTrend['monthly'], itemName: string) {
    if (monthly.length === 0) return <span style={{ color: INK_MUTED, fontStyle: 'italic', fontSize: 11 }}>—</span>;
    const max = Math.max(...monthly.map((m) => m.revenue), 1);
    const dx = monthly.length > 1 ? sparkW / (monthly.length - 1) : sparkW;
    const points = monthly
      .map((m, i) => `${(i * dx).toFixed(1)},${(sparkH - (m.revenue / max) * sparkH).toFixed(1)}`)
      .join(' ');
    const lastIdx = monthly.length - 1;
    return (
      <svg width={sparkW} height={sparkH} style={{ display: 'block' }}>
        <title>{`${itemName} · ${monthly.length} months · peak ${fmtMoney(max)} · last ${fmtMoney(monthly[lastIdx]?.revenue ?? 0)}`}</title>
        <polyline points={points} fill="none" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastIdx * dx} cy={sparkH - (monthly[lastIdx].revenue / max) * sparkH} r={2} fill={INK} />
      </svg>
    );
  }

  const pillRow: CSSProperties = {
    display: 'flex', gap: 0, alignItems: 'stretch', borderRadius: 4,
    border: `1px solid ${HAIRLINE}`, overflow: 'hidden', width: 'fit-content',
  };
  const pill = (active: boolean): CSSProperties => ({
    padding: '6px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? '#FFF' : INK, background: active ? INK : 'transparent',
    border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 500,
  });

  const countFor = (s: Segment) => {
    if (s === 'all') return items.length;
    return items.filter((it) => {
      const sd = (it.usali_subdept ?? '').toLowerCase();
      if (s === 'food')    return sd === 'food';
      if (s === 'drink')   return sd === 'beverage';
      if (s === 'minibar') return sd === 'minibar';
      return false;
    }).length;
  };

  return (
    <div style={{ background: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        {!hideSegments && <div style={pillRow}>
          {(['all', 'food', 'drink', 'minibar'] as Segment[]).map((s) => (
            <button key={s} type="button" onClick={() => { setSegment(s); setExpanded(false); }} style={pill(segment === s)}>
              {s === 'all' ? 'All' : s === 'food' ? 'Food' : s === 'drink' ? 'Drink' : 'Minibar'}
              <span style={{ marginLeft: 6, opacity: 0.6, fontSize: 10 }}>{countFor(s)}</span>
            </button>
          ))}
        </div>}
        <span style={{ fontSize: 11, color: INK_MUTED, fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Top {Math.min(visible.length, filtered.length)} of {filtered.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thL}>Rank</th>
              <th style={thL}>Item</th>
              <th style={thL}>{periods.length > 0 ? `${monthLabel(periods[0])} → ${monthLabel(periods[periods.length - 1])}` : 'Trend'}</th>
              <th style={th}>Total rev</th>
              <th style={th}>Avg / mo</th>
              <th style={th}>Months active</th>
              <th style={th}>Units</th>
              <th style={th}>Last sold</th>
              <th style={th}>Δ first→latest</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, color: INK_MUTED, fontStyle: 'italic', textAlign: 'center', fontSize: 12 }}>
                  No items in this segment.
                </td>
              </tr>
            ) : visible.map((it, idx) => {
              const tone = it.delta_pct == null ? 'muted' : it.delta_pct > 10 ? 'pos' : it.delta_pct < -10 ? 'neg' : 'muted';
              const deltaColor = tone === 'pos' ? GOOD : tone === 'neg' ? BAD : INK_MUTED;
              return (
                <tr key={it.description}
                    style={{ transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...td, textAlign: 'left', color: INK_MUTED, fontWeight: 500 }}>{idx + 1}</td>
                  <td style={{ ...tdL, fontWeight: 600 }}>{it.description}</td>
                  <td style={tdL}>{sparkline(it.monthly, it.description)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{fmtMoney(it.total_revenue_usd)}</td>
                  <td style={td}>{fmtMoney(it.avg_rev_per_active_month)}</td>
                  <td style={td}>{it.active_months}</td>
                  <td style={td}>{it.total_units}</td>
                  <td style={{ ...td, color: INK_MUTED }}>{it.last_sold ?? '—'}</td>
                  <td style={{ ...td, color: deltaColor, fontWeight: 600 }}>
                    {it.delta_pct == null ? '—' : `${it.delta_pct > 0 ? '+' : ''}${it.delta_pct.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {collapsible && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, padding: '0 4px' }}>
          <button type="button" onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'transparent', border: `1px solid ${HAIRLINE}`, padding: '6px 12px',
              cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: INK, borderRadius: 4,
            }}>
            {expanded ? 'Show top 10 ▴' : `Show all (${filtered.length}) ▾`}
          </button>
        </div>
      )}
    </div>
  );
}
