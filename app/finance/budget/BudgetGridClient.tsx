'use client';
// Budget grid with two independent drill-downs.
//
//  · Month  — every month header carries a +. Pressing it expands that month into
//             Budget · Act · Var $ · Var %. Several months can be open at once.
//  · Row    — every subcategory with accounts beneath it carries a ▸. Pressing it
//             reveals the account lines, including accounts that carry actuals but no
//             budget at all, which is how unbudgeted spend stops hiding in a subtotal.
//
// Act and the two variance columns are tinted so the eye can separate them from the
// budget column — the all-black grid was unreadable once four columns sat side by side.

import { Fragment, useState } from 'react';

export interface GridCell {
  budget: number;
  actual: number | null;
}

export interface AccountRef {
  code: string;
  name: string;
}

interface Props {
  months: string[];
  subcats: string[];
  /** key = `${month}|${subcat}` */
  cells: Record<string, GridCell>;
  revSubcats: string[];
  /** subcategory -> accounts beneath it, pre-sorted by FY budget */
  accountsBySubcat?: Record<string, AccountRef[]>;
  /** key = `${month}|${accountCode}` */
  detailCells?: Record<string, GridCell>;
  /**
   * Months whose actuals are NOT closed yet (gl_pl_monthly.is_final = false). August
   * 2026 carries 61 accounts against July's 83, so it reads as a 29% miss when it is
   * simply still open. Marked rather than hidden — a partial actual is still useful,
   * an unlabelled one is misleading.
   */
  provisionalMonths?: string[];
}

const fmtK = (n: number | null | undefined): string => {
  if (n == null || !isFinite(n) || n === 0) return '—';
  return `$${(n / 1000).toFixed(1)}k`;
};

function varPct(budget: number, actual: number | null): number | null {
  if (actual == null || !budget) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

// An overshoot is good on revenue and bad on a cost line, so the sign alone
// cannot pick the colour.
function varColor(v: number | null, isRevenue: boolean): string {
  if (v == null) return C.mute;
  const good = isRevenue ? v >= 0 : v <= 0;
  if (v === 0) return C.ink;
  return good ? C.good : C.bad;
}

const C = {
  ink: 'var(--ink, #1b1b1b)',
  mute: 'var(--ink-mute, #6b7280)',
  good: 'var(--status-green, #2E7D32)',
  bad: 'var(--terracotta, #B8542A)',
  act: '#1F3A72',              // deep blue — actuals
  actBg: 'rgba(31,58,114,0.055)',
  varBg: 'rgba(184,84,42,0.045)',
  budBg: 'rgba(0,0,0,0.025)',
};

export default function BudgetGridClient({
  months, subcats, cells, revSubcats, accountsBySubcat = {}, detailCells = {},
  provisionalMonths = [],
}: Props) {
  const provisional = new Set(provisionalMonths);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, k: string) => {
    const next = new Set(set);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  };

  const isRev = (s: string) => revSubcats.includes(s);
  const get = (m: string, s: string): GridCell => cells[`${m}|${s}`] ?? { budget: 0, actual: null };
  const getAcct = (m: string, code: string): GridCell => detailCells[`${m}|${code}`] ?? { budget: 0, actual: null };

  const sumRow = (s: string) => months.reduce((a, m) => a + get(m, s).budget, 0);
  const sumAcct = (code: string) => months.reduce((a, m) => a + getAcct(m, code).budget, 0);

  const groupSum = (m: string, which: 'rev' | 'cost', field: 'budget' | 'actual') =>
    subcats.filter((s) => (which === 'rev' ? isRev(s) : !isRev(s)))
      .reduce((a, s) => a + (get(m, s)[field] ?? 0), 0);
  const anyActual = (m: string, which: 'rev' | 'cost') =>
    subcats.some((s) => (which === 'rev' ? isRev(s) : !isRev(s)) && get(m, s).actual != null);

  /** The four cells rendered for one month when that month is expanded. */
  function expanded(c: GridCell, revenueLine: boolean, bold = false) {
    const dv = c.actual == null ? null : c.actual - c.budget;
    const pct = varPct(c.budget, c.actual);
    const w = bold ? 700 : 400;
    return (
      <>
        <td style={{ ...tdNum, background: C.budBg, fontWeight: w }}>{fmtK(c.budget)}</td>
        <td style={{ ...tdNum, background: C.actBg, color: C.act, fontWeight: bold ? 700 : 600 }}>
          {c.actual == null ? '—' : fmtK(c.actual)}
        </td>
        <td style={{ ...tdNum, background: C.varBg, color: varColor(dv, revenueLine), fontWeight: w }}>
          {dv == null ? '—' : `${dv > 0 ? '+' : '−'}$${(Math.abs(dv) / 1000).toFixed(1)}k`}
        </td>
        <td style={{ ...tdNum, background: C.varBg, color: varColor(pct, revenueLine), fontWeight: bold ? 700 : 600 }}>
          {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
        </td>
      </>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={th}>USALI subcategory</th>
            {months.map((m) => {
              const isOpen = openMonths.has(m);
              return (
                <th key={m} colSpan={isOpen ? 4 : 1} style={{ ...th, textAlign: 'right', ...(isOpen ? { background: C.budBg } : null) }}>
                  <button
                    onClick={() => setOpenMonths((s) => toggle(s, m))}
                    style={toggleBtn}
                    aria-expanded={isOpen}
                    title={isOpen ? `Collapse ${m}` : `Show actual and variance for ${m}`}
                  >
                    {m.slice(5)}
                    {provisional.has(m) && (
                      <span style={provMark} title="Month not closed — actuals are partial">°</span>
                    )}
                    {' '}<span style={sign}>{isOpen ? '−' : '+'}</span>
                  </button>
                </th>
              );
            })}
            <th style={{ ...th, textAlign: 'right' }}>FY total</th>
          </tr>
          {openMonths.size > 0 && (
            <tr>
              <th style={subTh} />
              {months.map((m) =>
                openMonths.has(m) ? (
                  <Fragment key={m}>
                    <th style={{ ...subTh, background: C.budBg }}>Budget</th>
                    <th style={{ ...subTh, background: C.actBg, color: C.act }}>Act</th>
                    <th style={{ ...subTh, background: C.varBg }}>Var $</th>
                    <th style={{ ...subTh, background: C.varBg }}>Var %</th>
                  </Fragment>
                ) : (
                  <th key={m} style={subTh} />
                ),
              )}
              <th style={subTh} />
            </tr>
          )}
        </thead>
        <tbody>
          {subcats.map((s) => {
            const accts = accountsBySubcat[s] ?? [];
            const rowOpen = openRows.has(s);
            return (
              <Fragment key={s}>
                <tr>
                  <td style={td}>
                    {accts.length > 0 ? (
                      <button onClick={() => setOpenRows((x) => toggle(x, s))} style={rowBtn} aria-expanded={rowOpen}
                        title={rowOpen ? `Hide accounts in ${s}` : `Show the ${accts.length} accounts in ${s}`}>
                        <span style={caret}>{rowOpen ? '▾' : '▸'}</span> <strong>{s}</strong>
                        <span style={acctCount}>{accts.length}</span>
                      </button>
                    ) : (
                      <strong>{s}</strong>
                    )}
                  </td>
                  {months.map((m) => {
                    const c = get(m, s);
                    if (!openMonths.has(m)) {
                      return <td key={m} style={{ ...tdNum, color: c.budget === 0 ? C.mute : undefined }}>{fmtK(c.budget)}</td>;
                    }
                    return <Fragment key={m}>{expanded(c, isRev(s))}</Fragment>;
                  })}
                  <td style={{ ...tdNum, fontWeight: 700 }}>{fmtK(sumRow(s))}</td>
                </tr>

                {rowOpen && accts.map((ac) => (
                  <tr key={ac.code} style={{ background: 'rgba(0,0,0,0.015)' }}>
                    <td style={{ ...td, paddingLeft: 30 }}>
                      <span style={acctCode}>{ac.code}</span> <span style={{ color: C.ink }}>{ac.name}</span>
                      {sumAcct(ac.code) === 0 && <span style={unbudgeted}>no budget</span>}
                    </td>
                    {months.map((m) => {
                      const c = getAcct(m, ac.code);
                      if (!openMonths.has(m)) {
                        return <td key={m} style={{ ...tdNum, color: c.budget === 0 ? C.mute : undefined }}>{fmtK(c.budget)}</td>;
                      }
                      return <Fragment key={m}>{expanded(c, isRev(s))}</Fragment>;
                    })}
                    <td style={tdNum}>{fmtK(sumAcct(ac.code))}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}

          {(['rev', 'cost'] as const).map((which, idx) => (
            <tr key={which} style={idx === 0 ? { borderTop: '2px solid var(--ink-soft, #5a5a5a)' } : undefined}>
              <td style={td}><strong>{which === 'rev' ? 'Revenue (sum)' : 'Total Costs'}</strong></td>
              {months.map((m) => {
                const c: GridCell = {
                  budget: groupSum(m, which, 'budget'),
                  actual: anyActual(m, which) ? groupSum(m, which, 'actual') : null,
                };
                if (!openMonths.has(m)) return <td key={m} style={{ ...tdNum, fontWeight: 700 }}>{fmtK(c.budget)}</td>;
                return <Fragment key={m}>{expanded(c, which === 'rev', true)}</Fragment>;
              })}
              <td style={{ ...tdNum, fontWeight: 700 }}>
                {fmtK(subcats.filter((s) => (which === 'rev' ? isRev(s) : !isRev(s))).reduce((a, s) => a + sumRow(s), 0))}
              </td>
            </tr>
          ))}

          <tr style={{ borderTop: '1px solid var(--ink-soft, #5a5a5a)' }}>
            <td style={td}><strong>Net Income (Rev − Costs)</strong></td>
            {months.map((m) => {
              const b = groupSum(m, 'rev', 'budget') - groupSum(m, 'cost', 'budget');
              const hasAct = anyActual(m, 'rev') || anyActual(m, 'cost');
              const a = hasAct ? groupSum(m, 'rev', 'actual') - groupSum(m, 'cost', 'actual') : null;
              if (!openMonths.has(m)) {
                return (
                  <td key={m} style={{ ...tdNum, color: b >= 0 ? C.good : C.bad, fontWeight: 700 }}>{fmtK(b)}</td>
                );
              }
              return <Fragment key={m}>{expanded({ budget: b, actual: a }, true, true)}</Fragment>;
            })}
            <td style={{ ...tdNum, fontWeight: 700 }}>
              {fmtK(
                subcats.filter(isRev).reduce((a, s) => a + sumRow(s), 0) -
                subcats.filter((s) => !isRev(s)).reduce((a, s) => a + sumRow(s), 0),
              )}
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
  ...th, textTransform: 'none', letterSpacing: 0, fontSize: 10, padding: '2px 10px 6px', textAlign: 'right',
};
const td: React.CSSProperties = {
  padding: '6px 10px', borderBottom: '1px solid var(--ink-soft, #ececec)',
  fontSize: 12, color: C.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
};
const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };
const toggleBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
  color: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
};
const rowBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
  color: 'inherit', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 5,
};
const sign: React.CSSProperties = { display: 'inline-block', marginLeft: 3, fontWeight: 700, color: C.bad };
const caret: React.CSSProperties = { color: C.bad, fontSize: 10, width: 9, display: 'inline-block' };
const acctCount: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.mute,
  background: 'rgba(0,0,0,0.05)', borderRadius: 8, padding: '0 6px',
};
const acctCode: React.CSSProperties = { fontFamily: 'monospace', fontSize: 10.5, color: C.mute, marginRight: 5 };
const unbudgeted: React.CSSProperties = {
  marginLeft: 7, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  color: C.bad, background: 'rgba(184,84,42,0.09)', borderRadius: 3, padding: '1px 5px',
};

// Superscript ring on a month whose actuals are still open. Deliberately quiet — it
// qualifies the number without competing with it.
const provMark: React.CSSProperties = {
  color: '#B8542A', fontWeight: 700, marginLeft: 1, verticalAlign: 'super', fontSize: 9,
};
