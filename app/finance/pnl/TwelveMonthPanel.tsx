'use client';

// 12-month rollup at the bottom of /finance/pnl.
// Compact view shows: Revenue / GOP / EBITDA per month + Actual / Budget / Variance trio.
// Click a row to expand → full USALI-line breakdown for that month.
// Inline sparkline chart via SVG (no chart lib needed).

import { useState } from 'react';

export interface TwelveMonthRow {
  period_yyyymm: string;
  usali_subcategory: string;
  usali_department: string;
  actual_usd: number;
  budget_usd: number;
  variance_usd: number;
  variance_pct: number | null;
}

export interface DemandRow {
  period_yyyymm: string;
  days: number;
  peak_days: number;
  lunar_days: number;
  avg_dow_score: number | null;
  avg_event_score: number | null;
}

interface Props {
  rows: TwelveMonthRow[];
  fy: string[]; // e.g. ['2026-01', ..., '2026-12']
  demand?: DemandRow[];
}

function fmtK(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const REV_SUBCATS = new Set(['Revenue']);
const COGS_SUBCATS = new Set(['Cost of Sales']);
const PAYROLL_SUBCATS = new Set(['Payroll & Related']);
const OPEX_SUBCATS = new Set(['Other Operating Expenses']);
const UNDIST_SUBCATS = new Set(['A&G', 'Sales & Marketing', 'POM', 'Utilities', 'Mgmt Fees']);

function aggregateMonth(rows: TwelveMonthRow[], period: string) {
  const r = rows.filter(x => x.period_yyyymm === period);
  let revA = 0, revB = 0;
  let cogsA = 0, cogsB = 0;
  let payA = 0, payB = 0;
  let opexA = 0, opexB = 0;
  let undistA = 0, undistB = 0;
  for (const x of r) {
    const a = Number(x.actual_usd || 0);
    const b = Number(x.budget_usd || 0);
    if (REV_SUBCATS.has(x.usali_subcategory)) {
      // pl_section_monthly stores income negative; mv_usali_pl_monthly may invert.
      // Use absolute revenue for the view (income shown positive).
      revA += Math.abs(a);
      revB += Math.abs(b);
    } else if (COGS_SUBCATS.has(x.usali_subcategory)) { cogsA += a; cogsB += b; }
    else if (PAYROLL_SUBCATS.has(x.usali_subcategory)) { payA += a; payB += b; }
    else if (OPEX_SUBCATS.has(x.usali_subcategory)) { opexA += a; opexB += b; }
    else if (UNDIST_SUBCATS.has(x.usali_subcategory)) { undistA += a; undistB += b; }
  }
  const deptProfitA = revA - cogsA - payA - opexA;
  const deptProfitB = revB - cogsB - payB - opexB;
  const gopA = deptProfitA - undistA;
  const gopB = deptProfitB - undistB;
  return {
    revA, revB,
    cogsA, cogsB,
    payA, payB,
    opexA, opexB,
    undistA, undistB,
    deptProfitA, deptProfitB,
    gopA, gopB,
  };
}

export default function TwelveMonthPanel({ rows, fy, demand = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const monthly = fy.map(p => ({ period: p, agg: aggregateMonth(rows, p) }));
  const demandByPeriod = new Map(demand.map(d => [d.period_yyyymm, d]));

  // Rollup totals
  const ytdRevA = monthly.reduce((s, m) => s + m.agg.revA, 0);
  const ytdRevB = monthly.reduce((s, m) => s + m.agg.revB, 0);
  const ytdGopA = monthly.reduce((s, m) => s + m.agg.gopA, 0);
  const ytdGopB = monthly.reduce((s, m) => s + m.agg.gopB, 0);

  // SVG sparkline geometry
  const chartW = 880;
  const chartH = 160;
  const padL = 40, padR = 20, padT = 12, padB = 24;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const allVals = monthly.flatMap(m => [m.agg.revA, m.agg.revB, m.agg.gopA, m.agg.gopB]);
  const vMax = Math.max(1000, ...allVals);
  const vMin = Math.min(0, ...allVals);
  const range = vMax - vMin || 1;
  function x(i: number) { return padL + (i / Math.max(monthly.length - 1, 1)) * innerW; }
  function y(v: number) { return padT + innerH - ((v - vMin) / range) * innerH; }
  const pathRevA = monthly.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.agg.revA)}`).join(' ');
  const pathRevB = monthly.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.agg.revB)}`).join(' ');
  const pathGopA = monthly.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.agg.gopA)}`).join(' ');
  const pathGopB = monthly.map((m, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(m.agg.gopB)}`).join(' ');

  // For expanded detail of one month
  function detailRows(period: string) {
    return rows
      .filter(r => r.period_yyyymm === period)
      .sort((a, b) => Math.abs(b.actual_usd) - Math.abs(a.actual_usd));
  }

  return (
    <section className="twelve-mo">
      <button type="button" className="header-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="caret">{open ? '▼' : '▶'}</span>
        <span className="title">12-month rollup · FY 2026</span>
        <span className="meta">
          Revenue actual {fmtK(ytdRevA)} · budget {fmtK(ytdRevB)} ·
          GOP actual {fmtK(ytdGopA)} · budget {fmtK(ytdGopB)}
        </span>
        <span className="hint">{open ? 'click to collapse' : 'click to expand'}</span>
      </button>

      {open && (
        <div className="body">
          {/* Sparkline chart */}
          <div className="chart-wrap">
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
              {/* zero line */}
              <line x1={padL} x2={chartW - padR} y1={y(0)} y2={y(0)} stroke="var(--line, #e7e2d8)" strokeDasharray="2 4" />
              {/* paths */}
              <path d={pathRevB} fill="none" stroke="var(--brass, #a17a4f)" strokeWidth="1.5" strokeDasharray="4 3" />
              <path d={pathRevA} fill="none" stroke="var(--green-2, #2e4a36)" strokeWidth="2" />
              <path d={pathGopB} fill="none" stroke="#b34939" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
              <path d={pathGopA} fill="none" stroke="#b34939" strokeWidth="2" />
              {/* dots + labels */}
              {monthly.map((m, i) => (
                <g key={m.period}>
                  <circle cx={x(i)} cy={y(m.agg.revA)} r="3" fill="var(--green-2, #2e4a36)" />
                  <text x={x(i)} y={chartH - 6} fontSize="10" textAnchor="middle" fill="var(--ink-mute, #8a8170)">{m.period.slice(5)}</text>
                </g>
              ))}
            </svg>
            <div className="legend">
              <span><i style={{ background: 'var(--green-2)' }} />Revenue · actual</span>
              <span><i style={{ background: 'var(--brass)', height: 1, borderTop: '2px dashed var(--brass)' }} />Revenue · budget</span>
              <span><i style={{ background: '#b34939' }} />GOP · actual</span>
              <span><i style={{ background: '#b34939', opacity: 0.6, height: 1, borderTop: '2px dashed #b34939' }} />GOP · budget</span>
            </div>
          </div>

          {/* Compact monthly grid */}
          <table className="rollup">
            <thead>
              <tr>
                <th></th>
                {monthly.map(m => <th key={m.period} className="num">{m.period.slice(5)}</th>)}
                <th className="num">FY</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hi">
                <td><strong>Revenue · actual</strong></td>
                {monthly.map(m => <td key={m.period} className="num">{fmtK(m.agg.revA)}</td>)}
                <td className="num"><strong>{fmtK(ytdRevA)}</strong></td>
              </tr>
              <tr className="bgt">
                <td>Revenue · budget</td>
                {monthly.map(m => <td key={m.period} className="num">{fmtK(m.agg.revB)}</td>)}
                <td className="num">{fmtK(ytdRevB)}</td>
              </tr>
              <tr className="var">
                <td>Revenue · variance</td>
                {monthly.map(m => {
                  const v = m.agg.revA - m.agg.revB;
                  const cls = v >= 0 ? 'var-green' : 'var-amber';
                  return <td key={m.period} className={`num ${cls}`}>{m.agg.revB ? fmtK(v) : '—'}</td>;
                })}
                <td className={`num ${ytdRevA - ytdRevB >= 0 ? 'var-green' : 'var-amber'}`}><strong>{ytdRevB ? fmtK(ytdRevA - ytdRevB) : '—'}</strong></td>
              </tr>
              <tr className="hi">
                <td><strong>GOP · actual</strong></td>
                {monthly.map(m => <td key={m.period} className="num">{fmtK(m.agg.gopA)}</td>)}
                <td className="num"><strong>{fmtK(ytdGopA)}</strong></td>
              </tr>
              <tr className="bgt">
                <td>GOP · budget</td>
                {monthly.map(m => <td key={m.period} className="num">{fmtK(m.agg.gopB)}</td>)}
                <td className="num">{fmtK(ytdGopB)}</td>
              </tr>
              <tr className="var">
                <td>GOP · variance</td>
                {monthly.map(m => {
                  const v = m.agg.gopA - m.agg.gopB;
                  const cls = v >= 0 ? 'var-green' : 'var-amber';
                  return <td key={m.period} className={`num ${cls}`}>{m.agg.gopB ? fmtK(v) : '—'}</td>;
                })}
                <td className={`num ${ytdGopA - ytdGopB >= 0 ? 'var-green' : 'var-amber'}`}><strong>{ytdGopB ? fmtK(ytdGopA - ytdGopB) : '—'}</strong></td>
              </tr>
              {demand.length > 0 && (
                <>
                  <tr style={{ borderTop: '1px solid var(--line)' }}>
                    <td>Demand · peak days</td>
                    {monthly.map(m => {
                      const d = demandByPeriod.get(m.period);
                      return <td key={m.period} className="num">{d ? `${d.peak_days}/${d.days}` : '—'}</td>;
                    })}
                    <td className="num">{demand.reduce((s, d) => s + (d.peak_days || 0), 0)}</td>
                  </tr>
                  <tr>
                    <td>Demand · lunar days</td>
                    {monthly.map(m => {
                      const d = demandByPeriod.get(m.period);
                      return <td key={m.period} className="num">{d ? d.lunar_days : '—'}</td>;
                    })}
                    <td className="num">{demand.reduce((s, d) => s + (d.lunar_days || 0), 0)}</td>
                  </tr>
                  <tr>
                    <td>Demand · event score</td>
                    {monthly.map(m => {
                      const d = demandByPeriod.get(m.period);
                      return <td key={m.period} className="num">{d && d.avg_event_score != null ? d.avg_event_score.toFixed(1) : '—'}</td>;
                    })}
                    <td className="num">—</td>
                  </tr>
                </>
              )}
              <tr className="expand-row">
                <td>Inspect month →</td>
                {monthly.map(m => (
                  <td key={m.period} className="num">
                    <button
                      type="button"
                      className={`exp-btn ${expandedMonth === m.period ? 'on' : ''}`}
                      onClick={() => setExpandedMonth(p => p === m.period ? null : m.period)}
                    >
                      {expandedMonth === m.period ? 'close' : 'open'}
                    </button>
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>

          {/* Expanded month detail */}
          {expandedMonth && (
            <div className="detail">
              <h4>Detail · {expandedMonth} · all USALI lines (actual / budget / variance)</h4>
              <table className="rollup detail-tbl">
                <thead>
                  <tr>
                    <th>Subcategory</th>
                    <th>Department</th>
                    <th className="num">Actual</th>
                    <th className="num">Budget</th>
                    <th className="num">Variance $</th>
                    <th className="num">Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows(expandedMonth).map((r, i) => (
                    <tr key={i}>
                      <td>{r.usali_subcategory}</td>
                      <td>{r.usali_department || <em style={{ color: 'var(--ink-mute)' }}>undistributed</em>}</td>
                      <td className="num">{fmtK(r.actual_usd)}</td>
                      <td className="num">{r.budget_usd ? fmtK(r.budget_usd) : <span style={{ color: 'var(--ink-mute)' }}>xx</span>}</td>
                      <td className={`num ${r.variance_usd >= 0 ? 'var-green' : 'var-amber'}`}>{r.budget_usd ? fmtK(r.variance_usd) : '—'}</td>
                      <td className="num">{r.variance_pct != null ? `${r.variance_pct >= 0 ? '+' : ''}${r.variance_pct.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                  {detailRows(expandedMonth).length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic', padding: 16 }}>No rows for {expandedMonth}.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        .twelve-mo { margin: 32px 0; border: 1px solid var(--line, #e7e2d8); border-radius: 8px; background: var(--card, #fff); overflow: hidden; }
        .header-toggle {
          display: flex; align-items: center; gap: 12px; width: 100%;
          background: var(--surf-2, #f5f1e7); border: none; cursor: pointer;
          padding: 14px 18px; text-align: left; font: inherit;
        }
        .header-toggle:hover { background: var(--surf-hover, #faf7ee); }
        .header-toggle .caret { color: var(--brass, #a17a4f); width: 18px; }
        .header-toggle .title { font-family: var(--font-display); font-weight: 500; font-size: 18px; flex-shrink: 0; }
        .header-toggle .meta { font-size: 12px; color: var(--ink-mute, #8a8170); flex: 1; }
        .header-toggle .hint { font-size: 11px; color: var(--ink-mute); font-style: italic; }
        .body { padding: 16px 18px 22px; }
        .chart-wrap { margin-bottom: 18px; }
        .chart-wrap svg { display: block; }
        .legend { display: flex; gap: 14px; font-size: 11px; color: var(--ink-mute, #8a8170); margin-top: 4px; flex-wrap: wrap; }
        .legend i { display: inline-block; width: 12px; height: 8px; margin-right: 4px; vertical-align: middle; }
        .rollup { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
        .rollup th { text-align: left; padding: 6px 8px; background: var(--surf-2, #f5f1e7); border-bottom: 1px solid var(--line); font-weight: 500; color: var(--ink-mute); font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
        .rollup td { padding: 6px 8px; border-bottom: 1px solid var(--line-soft, #efeae0); }
        .rollup .num { text-align: right; font-variant-numeric: tabular-nums; }
        .rollup tr.hi { background: rgba(46, 74, 54, .03); }
        .rollup tr.bgt { color: var(--ink-mute, #6a6353); }
        .rollup tr.var td { font-weight: 500; }
        .rollup tr.expand-row { background: var(--surf-2, #f5f1e7); }
        .var-green { color: var(--green-2, #2e4a36); }
        .var-amber { color: #b34939; }
        .exp-btn {
          padding: 2px 8px; font-size: 11px; background: #fff; color: var(--green-2);
          border: 1px solid var(--line); border-radius: 3px; cursor: pointer;
        }
        .exp-btn:hover { background: var(--green-2); color: #fff; }
        .exp-btn.on { background: var(--green-2); color: #fff; }
        .detail { margin-top: 18px; padding-top: 16px; border-top: 2px solid var(--line); }
        .detail h4 { font-family: var(--font-display); font-weight: 500; font-size: 14px; margin-bottom: 10px; }
        .detail-tbl { font-size: 12px; }
      `}</style>
    </section>
  );
}
