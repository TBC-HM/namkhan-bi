// app/holding/finance/pl/_components/PlMatrix.tsx
// A P&L laid out the way a P&L is read: MONTHS ACROSS THE TOP, accounts down
// the left, subtotals where an accountant expects them.
//
// PBS 2026-09-10: the earlier tables put months down the left and showed only
// department aggregates. That is a list, not a P&L — you cannot scan a line
// across the year, and you cannot see which account moved.
//
// Structure, top to bottom:
//   REVENUE      — one row per revenue account
//   Total revenue
//   DIRECT COST  — one row per direct-cost account
//   OVERHEAD     — one row per overhead account
//   Total costs
//   EBITDA
//
// Built by pivoting v_holding_pl_lines, which is already fetched. The only
// arithmetic here is summing rows the gold layer produced — no metric is
// re-derived and no figure is invented. Draft revenue is excluded, matching
// the rest of the module; it is reported separately on Overview.

import { Fragment } from 'react';
import type { PlLineRow } from '../_lib/types';
import { money, num, monthLabel } from '../_lib/format';
import { TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST, RUST } from './ui';

type AccountRow = {
  code: string; name: string; dept: string; type: string;
  months: Map<string, number>; total: number;
};

const TYPE_ORDER = ['revenue', 'direct_cost', 'overhead'] as const;
const TYPE_LABEL: Record<string, string> = {
  revenue: 'Revenue',
  direct_cost: 'Direct cost',
  overhead: 'Overhead',
};

export function buildMatrix(lines: PlLineRow[]) {
  const months = Array.from(new Set(lines.map((l) => l.period_yyyymm))).sort();
  const byAccount = new Map<string, AccountRow>();

  for (const l of lines) {
    // Draft revenue is not revenue (module rule). Costs have no draft concept.
    if (l.line_type === 'revenue' && l.is_draft) continue;
    const key = `${l.line_type}:${l.account_code}`;
    if (!byAccount.has(key)) {
      byAccount.set(key, {
        code: l.account_code, name: l.account_name, dept: l.dept_code,
        type: l.line_type, months: new Map(), total: 0,
      });
    }
    const a = byAccount.get(key)!;
    const v = num(l.amount_eur) ?? 0;
    a.months.set(l.period_yyyymm, (a.months.get(l.period_yyyymm) ?? 0) + v);
    a.total += v;
  }

  const sections = TYPE_ORDER.map((t) => ({
    type: t as string,
    label: TYPE_LABEL[t],
    rows: Array.from(byAccount.values())
      .filter((a) => a.type === t)
      .sort((a, b) => a.code.localeCompare(b.code)),
  })).filter((s) => s.rows.length > 0);

  const sumOf = (types: string[], mm?: string) =>
    Array.from(byAccount.values())
      .filter((a) => types.includes(a.type))
      .reduce((s, a) => s + (mm ? (a.months.get(mm) ?? 0) : a.total), 0);

  return { months, sections, sumOf };
}

export default function PlMatrix({ lines, currency, dense = false }: {
  lines: PlLineRow[]; currency: string; dense?: boolean;
}) {
  const { months, sections, sumOf } = buildMatrix(lines);
  if (months.length === 0) return null;

  const cell = dense ? { ...TD_NUM, padding: '4px 6px', fontSize: 11 } : TD_NUM;
  const head = dense ? { ...TH, padding: '4px 6px' } : TH;
  const label = dense ? { ...TD, padding: '4px 6px', fontSize: 11 } : TD;

  const totalRow = (
    text: string,
    types: string[],
    opts: { strong?: boolean; negate?: boolean; top?: boolean } = {},
  ) => (
    <tr key={text}>
      <td style={{
        ...label, whiteSpace: 'nowrap', fontWeight: 700,
        color: opts.strong ? FOREST : 'inherit',
        borderTop: opts.top ? `1px solid ${HAIR}` : undefined,
      }} colSpan={2}>{text}</td>
      {months.map((m) => {
        const v = sumOf(types, m);
        return (
          <td key={m} style={{
            ...cell, fontWeight: 700,
            color: opts.strong ? FOREST : 'inherit',
            borderTop: opts.top ? `1px solid ${HAIR}` : undefined,
          }}>
            {v ? (opts.negate ? `(${money(v, currency)})` : money(v, currency)) : ''}
          </td>
        );
      })}
      <td style={{
        ...cell, fontWeight: 700, color: FOREST,
        borderTop: opts.top ? `1px solid ${HAIR}` : undefined,
        borderLeft: `1px solid ${HAIR}`,
      }}>
        {opts.negate ? `(${money(sumOf(types), currency)})` : money(sumOf(types), currency)}
      </td>
    </tr>
  );

  const ebitda = (mm?: string) => sumOf(['revenue'], mm) - sumOf(['direct_cost', 'overhead'], mm);

  return (
    <div style={SCROLL_X}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={head}>Account</th>
            <th style={head}>Dept</th>
            {months.map((m) => (
              <th key={m} style={{ ...head, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {monthLabel(m)}
              </th>
            ))}
            <th style={{ ...head, textAlign: 'right', color: FOREST, borderLeft: `1px solid ${HAIR}` }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => (
            <Fragment key={sec.type}>
              <tr>
                <td style={{
                  ...label, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.06em', fontSize: 10, color: INK_M,
                  background: '#FAFAF7', borderTop: `1px solid ${HAIR}`,
                }} colSpan={months.length + 3}>{sec.label}</td>
              </tr>
              {sec.rows.map((a) => (
                <tr key={`${sec.type}-${a.code}`}>
                  <td style={label}>
                    <span style={{ fontWeight: 600 }}>{a.code}</span>
                    <span style={{ color: INK_M }}> · {a.name}</span>
                  </td>
                  <td style={{ ...label, color: FOREST, fontWeight: 600 }}>{a.dept}</td>
                  {months.map((m) => {
                    const v = a.months.get(m);
                    return <td key={m} style={cell}>{v ? money(v, currency) : ''}</td>;
                  })}
                  <td style={{ ...cell, fontWeight: 600, borderLeft: `1px solid ${HAIR}` }}>
                    {money(a.total, currency)}
                  </td>
                </tr>
              ))}
              {sec.type === 'revenue' && totalRow('Total revenue', ['revenue'], { top: true })}
              {sec.type === 'overhead' && totalRow('Total costs', ['direct_cost', 'overhead'], { negate: true, top: true })}
            </Fragment>
          ))}

          {/* If there is no overhead section the cost subtotal still has to appear. */}
          {!sections.some((s) => s.type === 'overhead')
            && sections.some((s) => s.type === 'direct_cost')
            && totalRow('Total costs', ['direct_cost'], { negate: true, top: true })}

          <tr>
            <td style={{
              ...label, fontWeight: 700, color: FOREST, whiteSpace: 'nowrap',
              borderTop: `2px solid ${FOREST}`,
            }} colSpan={2}>EBITDA</td>
            {months.map((m) => {
              const e = ebitda(m);
              return (
                <td key={m} style={{
                  ...cell, fontWeight: 700, borderTop: `2px solid ${FOREST}`,
                  color: e < 0 ? RUST : FOREST,
                }}>{e ? money(e, currency) : ''}</td>
              );
            })}
            <td style={{
              ...cell, fontWeight: 700, borderTop: `2px solid ${FOREST}`,
              borderLeft: `1px solid ${HAIR}`,
              color: ebitda() < 0 ? RUST : FOREST,
            }}>{money(ebitda(), currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
