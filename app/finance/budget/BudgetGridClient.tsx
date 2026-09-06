'use client';
// Budget grid with per-month drill-out.
// Each month header carries a +; pressing it expands that month into three columns:
// Budget · Act (USD) · Var %. Collapsed months stay a single budget column, so the
// grid still fits without horizontal scrolling until you ask for detail.

import { Fragment, useState } from 'react';

export interface GridCell {
  budget: number;
  actual: number | null;
}

interface Props {
  months: string[];
  subcats: string[];
  /** key = `${month}|${subcat}` */
  cells: Record<string, GridCell>;
  revSubcats: string[];
}

const fmtK = (n: number | null | undefined): string => {
  if (n == null || !isFinite(n) || n === 0) return '—';
  return `$${(n / 1000).toFixed(1)}k`;
};

// Variance is expressed against budget. For a cost line an overspend is bad, for a
// revenue line an overshoot is good — so the sign alone cannot pick the colour.
function varPct(budget: number, actual: number | null): number | null {
  if (actual == null || !budget) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

function varColor(pct: number | null, isRevenue: boolean): string {
  if (pct == null) return 'var(--ink-mute, #6b7280)';
  const good = isRevenue ? pct >= 0 : pct <= 0;
  if (Math.abs(pct) < 2) return 'var(--ink, #1b1b1b)';
  return good ? 'var(--status-green, #2E7D32)' : 'var(--terracotta, #B8542A)';
}

export default function BudgetGridClient({ months, subcats, cells, revSubcats }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });

  const isRev = (s: string) => revSubcats.includes(s);
  const get = (m: string, s: string): GridCell => cells[`${m}|${s}`] ?? { budget: 0, actual: null };

  const sumRow = (s: string) =>
    months.reduce((a, m) => a + get(m, s).budget, 0);

  const groupSum = (m: string, which: 'rev' | 'cost', field: 'budget' | 'actual') =>
    subcats
      .filter((s) => (which === 'rev' ? isRev(s) : !isRev(s)))
      .reduce((a, s) => {
        const v = get(m, s)[field];
        return a + (v ?? 0);
      }, 0);

  const anyActual = (m: string, which: 'rev' | 'cost') =>
    subcats.some((s) => (which === 'rev' ? isRev(s) : !isRev(s)) && get(m, s).actual != null);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>USALI subcategory</th>
            {months.map((m) => {
              const isOpen = open.has(m);
              return (
                <th key={m} colSpan={isOpen ? 3 : 1} style={{ ...th, textAlign: 'right', ...(isOpen ? openHead : null) }}>
                  <button
                    onClick={() => toggle(m)}
                    style={toggleBtn}
                    aria-expanded={isOpen}
                    title={isOpen ? `Collapse ${m}` : `Show actual and variance for ${m}`}
                  >
                    {m.slice(5)} <span style={sign}>{isOpen ? '−' : '+'}</span>
                  </button>
                </th>
              );
            })}
            <th style={{ ...th, textAlign: 'right' }}>FY total</th>
          </tr>
          {open.size > 0 && (
            <tr>
              <th style={subTh} />
              {months.map((m) =>
                open.has(m) ? (
                  <Fragment key={m}>
                    <th style={{ ...subTh, ...openHead }}>Budget</th>
                    <th style={subTh}>Act</th>
                    <th style={subTh}>Var %</th>
                  </Fragment>
                ) : (
                  <th key={`${m}-x`} style={subTh} />
                ),
              )}
              <th style={subTh} />
            </tr>
          )}
        </thead>
        <tbody>
          {subcats.map((s) => (
            <tr key={s}>
              <td style={td}><strong>{s}</strong></td>
              {months.map((m) => {
                const c = get(m, s);
                const isOpen = open.has(m);
                const pct = varPct(c.budget, c.actual);
                if (!isOpen) {
                  return (
                    <td key={m} style={{ ...td, textAlign: 'right', color: c.budget === 0 ? 'var(--ink-mute, #6b7280)' : undefined }}>
                      {fmtK(c.budget)}
                    </td>
                  );
                }
                return (
                  <Fragment key={m}>
                    <td style={{ ...td, textAlign: 'right', ...openCell }}>{fmtK(c.budget)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.actual == null ? '—' : fmtK(c.actual)}</td>
                    <td style={{ ...td, textAlign: 'right', color: varColor(pct, isRev(s)), fontWeight: pct == null ? 400 : 600 }}>
                      {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
                    </td>
                  </Fragment>
                );
              })}
              <td style={{ ...td, textAlign: 'right' }}><strong>{fmtK(sumRow(s))}</strong></td>
            </tr>
          ))}

          {(['rev', 'cost'] as const).map((which, idx) => (
            <tr key={which} style={idx === 0 ? { borderTop: '2px solid var(--ink-soft, #5a5a5a)' } : undefined}>
              <td style={td}><strong>{which === 'rev' ? 'Revenue (sum)' : 'Total Costs'}</strong></td>
              {months.map((m) => {
                const b = groupSum(m, which, 'budget');
                const a = anyActual(m, which) ? groupSum(m, which, 'actual') : null;
                const pct = varPct(b, a);
                if (!open.has(m)) {
                  return <td key={m} style={{ ...td, textAlign: 'right' }}><strong>{fmtK(b)}</strong></td>;
                }
                return (
                  <Fragment key={m}>
                    <td style={{ ...td, textAlign: 'right', ...openCell }}><strong>{fmtK(b)}</strong></td>
                    <td style={{ ...td, textAlign: 'right' }}><strong>{a == null ? '—' : fmtK(a)}</strong></td>
                    <td style={{ ...td, textAlign: 'right', color: varColor(pct, which === 'rev'), fontWeight: 600 }}>
                      {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
                    </td>
                  </Fragment>
                );
              })}
              <td style={{ ...td, textAlign: 'right' }}>
                <strong>
                  {fmtK(subcats.filter((s) => (which === 'rev' ? isRev(s) : !isRev(s))).reduce((a, s) => a + sumRow(s), 0))}
                </strong>
              </td>
            </tr>
          ))}

          <tr style={{ borderTop: '1px solid var(--ink-soft, #5a5a5a)' }}>
            <td style={td}><strong>Net Income (Rev − Costs)</strong></td>
            {months.map((m) => {
              const b = groupSum(m, 'rev', 'budget') - groupSum(m, 'cost', 'budget');
              const hasAct = anyActual(m, 'rev') || anyActual(m, 'cost');
              const a = hasAct ? groupSum(m, 'rev', 'actual') - groupSum(m, 'cost', 'actual') : null;
              const pct = varPct(b, a);
              const money = (v: number | null) => (
                <span style={{ color: v == null ? 'var(--ink-mute, #6b7280)' : v >= 0 ? 'var(--status-green, #2E7D32)' : 'var(--terracotta, #B8542A)', fontWeight: 700 }}>
                  {v == null ? '—' : fmtK(v)}
                </span>
              );
              if (!open.has(m)) return <td key={m} style={{ ...td, textAlign: 'right' }}>{money(b)}</td>;
              return (
                <Fragment key={m}>
                  <td style={{ ...td, textAlign: 'right', ...openCell }}>{money(b)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(a)}</td>
                  <td style={{ ...td, textAlign: 'right', color: varColor(pct, true), fontWeight: 600 }}>
                    {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
                  </td>
                </Fragment>
              );
            })}
            <td style={{ ...td, textAlign: 'right' }}>
              <strong>
                {fmtK(
                  subcats.filter(isRev).reduce((a, s) => a + sumRow(s), 0) -
                  subcats.filter((s) => !isRev(s)).reduce((a, s) => a + sumRow(s), 0),
                )}
              </strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--ink-soft, #d4d4d8)',
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ink-soft, #5a5a5a)', fontWeight: 600, whiteSpace: 'nowrap',
};
const subTh: React.CSSProperties = {
  ...th, textTransform: 'none', letterSpacing: 0, fontSize: 10, padding: '2px 10px 6px',
  textAlign: 'right', borderBottom: '1px solid var(--ink-soft, #d4d4d8)',
};
const td: React.CSSProperties = {
  padding: '6px 10px', borderBottom: '1px solid var(--ink-soft, #ececec)',
  fontSize: 12, color: 'var(--ink, #1b1b1b)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
};
const openHead: React.CSSProperties = { background: 'rgba(31,58,46,0.04)' };
const openCell: React.CSSProperties = { background: 'rgba(31,58,46,0.03)' };
const toggleBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
  color: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
};
const sign: React.CSSProperties = {
  display: 'inline-block', marginLeft: 3, fontWeight: 700, color: 'var(--terracotta, #B8542A)',
};
