// app/finance/pnl/CashForecastPanel.tsx
// 13-week rolling cash forecast — derived from gl.v_cash_forecast_13w.
// Inflows (OTB reservations + AR aging) + Outflows (fixed + supplier estimate).
// Position assumes $0 starting cash unless ?cash0= URL param overrides.

import type { CashForecastRow } from '../_data';

interface Props {
  rows: CashForecastRow[];
  startingCash?: number;
}

function fmtK(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

export default function CashForecastPanel({ rows, startingCash = 0 }: Props) {
  if (rows.length === 0) {
    return (
      <div className="meta" style={{ padding: 8 }}>No reservations or AR data — cash forecast unavailable.</div>
    );
  }

  // Running position
  let position = startingCash;
  const series = rows.map(r => {
    position += r.net_cash_flow;
    return { ...r, position };
  });

  const minPos = Math.min(...series.map(s => s.position));
  const maxPos = Math.max(...series.map(s => s.position));
  const range = Math.max(1, maxPos - minPos);

  const totalIn  = rows.reduce((s, r) => s + r.otb_inflow + r.ar_inflow, 0);
  const totalOut = rows.reduce((s, r) => s + r.fixed_outflow + r.supplier_outflow, 0);
  const totalNet = totalIn + totalOut;

  // Find weeks where position dips below zero
  const dipWeeks = series.filter(s => s.position < 0).map(s => s.iso_week);
  const dipFlag = dipWeeks.length > 0
    ? `cash dip ${dipWeeks[0]}${dipWeeks.length > 1 ? ' (+' + (dipWeeks.length - 1) + ' more)' : ''}`
    : `13w net ${fmtK(totalNet)}`;

  // Bar layout: each week is a flex item.
  const bars = series.map((s, i) => {
    const norm = (s.position - minPos) / range;
    const color = s.position < 0 ? 'var(--st-bad, #b34939)' : 'var(--green-2, #2e4a36)';
    return { ...s, norm, color, x: i };
  });

  return (
    <>
      <div className="cash-strip" style={{ position: 'relative', height: 64, background: 'var(--surf-2, #f5f1e7)', border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%', padding: 4 }}>
          {bars.map(b => (
            <div
              key={b.iso_week}
              title={`${b.iso_week} (${b.week_start})\nInflows: ${fmtK(b.otb_inflow + b.ar_inflow)}\nOutflows: ${fmtK(b.fixed_outflow + b.supplier_outflow)}\nNet: ${fmtK(b.net_cash_flow)}\nPosition: ${fmtK(b.position)}`}
              style={{
                flex: 1,
                height: `${Math.max(8, b.norm * 100)}%`,
                background: b.color,
                borderRadius: '2px 2px 0 0',
                minWidth: 8,
              }}
            />
          ))}
        </div>
        <div className="flag" style={{
          position: 'absolute',
          top: 4, right: 6,
          background: dipWeeks.length > 0 ? 'var(--st-bad, #b34939)' : 'var(--green-2, #2e4a36)',
          color: 'var(--paper-warm, #f4ede0)',
          fontSize: 'var(--t-xs)',
          padding: '2px 8px',
          borderRadius: 3,
          fontFamily: 'var(--mono)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
        }}>
          {dipFlag}
        </div>
      </div>
      <div className="legend" style={{ display: 'flex', gap: 16, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginTop: 6, flexWrap: 'wrap' }}>
        <span>In: {fmtK(totalIn)} (OTB + AR)</span>
        <span>Out: {fmtK(totalOut)} (fixed + supplier)</span>
        <span>Net 13w: <strong style={{ color: totalNet >= 0 ? 'var(--green-2)' : 'var(--st-bad)' }}>{fmtK(totalNet)}</strong></span>
        <span>Min position: <strong style={{ color: minPos >= 0 ? 'var(--green-2)' : 'var(--st-bad)' }}>{fmtK(minPos)}</strong></span>
        <span style={{ fontStyle: 'italic' }}>start = {fmtK(startingCash)}</span>
      </div>
    </>
  );
}
