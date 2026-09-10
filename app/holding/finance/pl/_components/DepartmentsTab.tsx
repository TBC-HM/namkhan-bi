// app/holding/finance/pl/_components/DepartmentsTab.tsx
// Brief holding-pl-v1 v2 · Departments.
//
// The department list is NEVER hardcoded. Whatever fn_holding_pl_payload
// returns in by_department is what renders, in the order returned. A new
// department in holding.gl_entries appears here with no code change.
//
// "Overhead only, not allocated" is DERIVED (revenue and direct cost both nil
// while overhead is not), never keyed off a department code.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload, PlMonthlyRow, PlLineRow } from '../_lib/types';
import type { Fetched } from '../_lib/fetchPayload';
import { money, monthLabel, num } from '../_lib/format';
import {
  TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST,
  EmptyLine, ErrorPanel, LayerNote, Flag,
} from './ui';
import PlMatrix from './PlMatrix';

function isOverheadOnly(d: { revenue_eur: number; direct_cost_eur: number; overhead_eur: number }): boolean {
  return (num(d.revenue_eur) ?? 0) === 0
    && (num(d.direct_cost_eur) ?? 0) === 0
    && (num(d.overhead_eur) ?? 0) !== 0;
}

export default function DepartmentsTab({ p, monthly, lines }: {
  p: HoldingPlPayload;
  monthly: Fetched<PlMonthlyRow[]>;
  lines: Fetched<PlLineRow[]>;
}) {
  const cur = p.reporting_currency;
  const depts = p.by_department;

  // Column totals are a sum of what is displayed, so the table foots to itself.
  const sum = (k: 'revenue_eur' | 'direct_cost_eur' | 'overhead_eur' | 'margin_eur') =>
    depts.reduce((s, d) => s + (num(d[k]) ?? 0), 0);

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title={`Departments · ${depts.length}`}
          subtitle="Overhead is reported where it is incurred and is never pushed into a revenue department."
          density="compact"
        >
          {depts.length === 0 ? (
            <EmptyLine what="No department carries a figure in this period. Clear the period filter to use the full range." />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Code</th>
                    <th style={TH}>Department</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Direct cost</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Overhead</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {depts.map((d) => {
                    const overheadOnly = isOverheadOnly(d);
                    const margin = num(d.margin_eur);
                    return (
                      <tr key={d.dept_code}>
                        <td style={{ ...TD, fontWeight: 700, color: FOREST, whiteSpace: 'nowrap' }}>
                          {d.dept_code}
                        </td>
                        <td style={TD}>
                          {d.dept_name}
                          {overheadOnly && (
                            <>
                              {' '}
                              <Flag tone="neutral">overhead only · not allocated</Flag>
                            </>
                          )}
                        </td>
                        <td style={TD_NUM}>{money(d.revenue_eur, cur)}</td>
                        <td style={TD_NUM}>{money(d.direct_cost_eur, cur)}</td>
                        <td style={TD_NUM}>{money(d.overhead_eur, cur)}</td>
                        <td style={{
                          ...TD_NUM, fontWeight: 700,
                          color: margin !== null && margin < 0 ? '#8C3B2E' : 'inherit',
                        }}>{money(d.margin_eur, cur)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ ...TD, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }} colSpan={2}>
                      Total
                    </td>
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }}>
                      {money(sum('revenue_eur'), cur)}
                    </td>
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }}>
                      {money(sum('direct_cost_eur'), cur)}
                    </td>
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }}>
                      {money(sum('overhead_eur'), cur)}
                    </td>
                    <td style={{ ...TD_NUM, borderTop: `1px solid ${HAIR}`, fontWeight: 700 }}>
                      {money(sum('margin_eur'), cur)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
            Departmental margin is revenue less direct cost. Overhead sits in the
            department that incurs it and is deducted once, at entity level, in EBITDA.
          </div>
          <LayerNote currency={cur} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Profit & loss · account by month"
          subtitle="Months across the top, every revenue and cost account down the side, with subtotals and EBITDA."
          density="compact"
        >
          {!lines.ok || !lines.data ? (
            <ErrorPanel what="The account detail" message={lines.error ?? 'Unknown error'} />
          ) : lines.data.length === 0 ? (
            <EmptyLine what="No posting falls inside this period." />
          ) : (
            <PlMatrix lines={lines.data} currency={cur} dense />
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
            Draft revenue is excluded here and reported separately on Overview.
            A blank cell means nothing was booked to that account that month.
          </div>
          <LayerNote currency={cur} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Department by month"
          subtitle="public.v_holding_pl_monthly · per-department detail including draft and estimate columns"
          density="compact"
        >
          {!monthly.ok || !monthly.data ? (
            <ErrorPanel what="Monthly department detail" message={monthly.error ?? 'Unknown error'} />
          ) : monthly.data.length === 0 ? (
            <EmptyLine what="v_holding_pl_monthly returned no row inside this period." />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Month</th>
                    <th style={TH}>Code</th>
                    <th style={TH}>Department</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Draft</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Direct cost</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Overhead</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Margin</th>
                    <th style={{ ...TH, textAlign: 'right' }}>of which estimated</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.data.map((r, i) => (
                    <tr key={`${r.period_yyyymm}-${r.dept_code}-${i}`}>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{monthLabel(r.period_yyyymm)}</td>
                      <td style={{ ...TD, fontWeight: 700, color: FOREST }}>{r.dept_code}</td>
                      <td style={TD}>{r.dept_name}</td>
                      <td style={TD_NUM}>{money(r.revenue_eur, cur)}</td>
                      <td style={{ ...TD_NUM, color: INK_M }}>{money(r.revenue_draft_eur, cur)}</td>
                      <td style={TD_NUM}>{money(r.direct_cost_eur, cur)}</td>
                      <td style={TD_NUM}>{money(r.overhead_eur, cur)}</td>
                      <td style={TD_NUM}>{money(r.dept_margin_eur, cur)}</td>
                      <td style={TD_NUM}>
                        {(num(r.estimated_eur) ?? 0) !== 0
                          ? <><Flag tone="estimate">est</Flag>{' '}{money(r.estimated_eur, cur)}</>
                          : money(r.estimated_eur, cur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LayerNote currency={cur} />
        </Container>
      </div>
    </>
  );
}
