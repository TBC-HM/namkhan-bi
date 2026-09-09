// app/holding/finance/pl/_components/BudgetTab.tsx
// Budget & forecast for TBC Management FZCO. Brief holding-budget-v1.
//
// Reads public.fn_holding_budget_payload — one RPC, same contract as the P&L.
// The gold layer does every calculation; this file only lays figures out.
//
// VARIANCE CONVENTION (stated on the page, not just here): variance is
// actual - plan. On revenue a positive variance is ahead of plan; on cost a
// positive variance is overspend. The colour follows that meaning, so an
// overspend never renders green just because the number went up.
//
// Departments, accounts and months all iterate the payload. No code, account
// or period is written down in this file, and no figure is ever defaulted —
// an absent plan renders an empty state, not a zero pretending to be a budget.

import { Container, MetricRow, type KpiTileProps } from '@/app/(cockpit)/_design';
import type { HoldingBudgetPayload } from '../_lib/types';
import { money, num, monthLabel, count } from '../_lib/format';
import {
  TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST, RUST,
  EmptyLine, LayerNote,
} from './ui';

/** actual - plan. Null when there is no plan to compare against. */
function variance(actual: unknown, plan: unknown): number | null {
  const a = num(actual);
  const p = num(plan);
  if (a === null || p === null) return null;
  return a - p;
}

/** Colour by MEANING, not by sign: overspend is never green. */
function varianceColor(v: number | null, kind: 'revenue' | 'cost'): string {
  if (v === null || v === 0) return INK_M;
  const good = kind === 'revenue' ? v > 0 : v < 0;
  return good ? FOREST : RUST;
}

function VarCell({ v, kind, currency }: {
  v: number | null; kind: 'revenue' | 'cost'; currency: string;
}) {
  return (
    <td style={{ ...TD_NUM, color: varianceColor(v, kind), fontWeight: v ? 700 : 400 }}>
      {v === null ? '—' : `${v > 0 ? '+' : ''}${money(v, currency)}`}
    </td>
  );
}

export default function BudgetTab({ b }: { b: HoldingBudgetPayload }) {
  const cur = b.reporting_currency;
  const { budget, forecast, actual } = b.totals;
  const planned = b.coverage.has_plan;

  const tiles: KpiTileProps[] = [
    { label: 'EBITDA · actual', value: money(actual.ebitda_eur, cur), size: 'sm',
      footnote: `${cur} reporting layer · posted ledger` },
    { label: 'EBITDA · budget', value: planned ? money(budget.ebitda_eur, cur) : '—', size: 'sm',
      status: planned ? undefined : 'grey',
      footnote: planned ? 'Plan of record' : 'No budget entered yet' },
    { label: 'EBITDA · forecast', value: b.coverage.forecast_lines > 0 ? money(forecast.ebitda_eur, cur) : '—',
      size: 'sm', status: b.coverage.forecast_lines > 0 ? undefined : 'grey',
      footnote: b.coverage.forecast_lines > 0 ? 'Latest thinking' : 'No forecast entered yet' },
    { label: 'Revenue · actual vs budget',
      value: planned ? `${(variance(actual.revenue_eur, budget.revenue_eur) ?? 0) > 0 ? '+' : ''}${money(variance(actual.revenue_eur, budget.revenue_eur), cur)}` : '—',
      size: 'sm', status: planned ? undefined : 'grey',
      footnote: 'Positive = ahead of plan' },
    { label: 'Cost · actual vs budget',
      value: planned ? `${(variance(Number(actual.direct_cost_eur) + Number(actual.overhead_eur), Number(budget.direct_cost_eur) + Number(budget.overhead_eur)) ?? 0) > 0 ? '+' : ''}${money(variance(Number(actual.direct_cost_eur) + Number(actual.overhead_eur), Number(budget.direct_cost_eur) + Number(budget.overhead_eur)), cur)}` : '—',
      size: 'sm', status: planned ? undefined : 'grey',
      footnote: 'Positive = overspend' },
    { label: 'Plan coverage', value: planned ? `${count(b.coverage.months_planned)} month(s)` : 'None',
      size: 'sm', status: planned ? undefined : 'amber',
      footnote: `${count(b.coverage.budget_lines)} budget · ${count(b.coverage.forecast_lines)} forecast line(s)` },
  ];

  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={tiles} size="sm" />
      </div>

      {!planned && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title="No plan entered yet"
            subtitle="Actuals are live below. Budget and forecast columns stay empty until a plan exists."
            density="compact"
            status="amber"
          >
            <div style={{ fontSize: 13, color: INK_M, lineHeight: 1.6 }}>
              Nothing here is invented. The budget and forecast columns read{' '}
              <code>public.v_holding_budget_lines</code>, which currently holds no rows,
              so they show a dash rather than a zero pretending to be a decision.
              <div style={{ marginTop: 10 }}>
                A plan can be seeded from posted actuals — every seeded figure traces
                to a real ledger line and is stamped as derived, so it is never
                mistaken for a number someone chose. Seeding is append-forward:
                re-seeding adds a new version and never overwrites what is there.
              </div>
            </div>
          </Container>
        </div>
      )}

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="By month"
          subtitle={`Budget · forecast · actual, ${cur} reporting layer`}
          density="compact"
        >
          {b.by_month.length === 0 ? (
            <EmptyLine what="No month falls in this period. Widen the period or clear it." />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Month</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue budget</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue forecast</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue actual</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Rev variance</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cost budget</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cost forecast</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cost actual</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cost variance</th>
                  </tr>
                </thead>
                <tbody>
                  {b.by_month.map((m) => (
                    <tr key={m.period_yyyymm}>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>{monthLabel(m.period_yyyymm)}</td>
                      <td style={TD_NUM}>{planned ? money(m.budget_revenue_eur, cur) : '—'}</td>
                      <td style={{ ...TD_NUM, color: INK_M }}>
                        {b.coverage.forecast_lines > 0 ? money(m.forecast_revenue_eur, cur) : '—'}
                      </td>
                      <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(m.actual_revenue_eur, cur)}</td>
                      <VarCell v={planned ? variance(m.actual_revenue_eur, m.budget_revenue_eur) : null} kind="revenue" currency={cur} />
                      <td style={TD_NUM}>{planned ? money(m.budget_cost_eur, cur) : '—'}</td>
                      <td style={{ ...TD_NUM, color: INK_M }}>
                        {b.coverage.forecast_lines > 0 ? money(m.forecast_cost_eur, cur) : '—'}
                      </td>
                      <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(m.actual_cost_eur, cur)}</td>
                      <VarCell v={planned ? variance(m.actual_cost_eur, m.budget_cost_eur) : null} kind="cost" currency={cur} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
            Variance is actual less plan. On revenue a positive figure is ahead of
            plan; on cost a positive figure is overspend.
          </div>
          <LayerNote currency={cur} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="By department" subtitle="Budget versus actual, per department" density="compact">
          {b.by_department.length === 0 ? (
            <EmptyLine what="No department carries a figure in this period." />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Code</th>
                    <th style={TH}>Department</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue budget</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Revenue actual</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Variance</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cost budget</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Cost actual</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {b.by_department.map((d) => (
                    <tr key={d.dept_code}>
                      <td style={{ ...TD, fontWeight: 700, color: FOREST }}>{d.dept_code}</td>
                      <td style={TD}>{d.dept_name}</td>
                      <td style={TD_NUM}>{planned ? money(d.budget_revenue_eur, cur) : '—'}</td>
                      <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(d.actual_revenue_eur, cur)}</td>
                      <VarCell v={planned ? variance(d.actual_revenue_eur, d.budget_revenue_eur) : null} kind="revenue" currency={cur} />
                      <td style={TD_NUM}>{planned ? money(d.budget_cost_eur, cur) : '—'}</td>
                      <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(d.actual_cost_eur, cur)}</td>
                      <VarCell v={planned ? variance(d.actual_cost_eur, d.budget_cost_eur) : null} kind="cost" currency={cur} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LayerNote currency={cur} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title={`By account · ${b.by_account.length}`}
          subtitle="The line level a plan is actually built at"
          density="compact"
        >
          {b.by_account.length === 0 ? (
            <EmptyLine what="No account carries a plan or an actual in this period." />
          ) : (
            <div style={SCROLL_X}>
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Dept</th>
                    <th style={TH}>Account</th>
                    <th style={TH}>Type</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Budget</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Forecast</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Actual</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {b.by_account.map((a) => {
                    const kind: 'revenue' | 'cost' = a.line_type === 'revenue' ? 'revenue' : 'cost';
                    return (
                      <tr key={`${a.dept_code}-${a.account_code}`}>
                        <td style={{ ...TD, color: FOREST, fontWeight: 600 }}>{a.dept_code}</td>
                        <td style={TD}>
                          <div style={{ fontWeight: 600 }}>{a.account_code}</div>
                          <div style={{ color: INK_M, fontSize: 11 }}>{a.account_name}</div>
                        </td>
                        <td style={{ ...TD, color: INK_M, whiteSpace: 'nowrap' }}>{a.line_type}</td>
                        <td style={TD_NUM}>{planned ? money(a.budget_eur, cur) : '—'}</td>
                        <td style={{ ...TD_NUM, color: INK_M }}>
                          {b.coverage.forecast_lines > 0 ? money(a.forecast_eur, cur) : '—'}
                        </td>
                        <td style={{ ...TD_NUM, fontWeight: 600 }}>{money(a.actual_eur, cur)}</td>
                        <VarCell v={planned ? variance(a.actual_eur, a.budget_eur) : null} kind={kind} currency={cur} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11, color: INK_M, marginTop: 8, borderTop: `1px solid ${HAIR}`, paddingTop: 6 }}>
            Accounts appear here as soon as they carry a plan or a posting — including
            the beyondcircle.ai platform cost groups once anything is booked to them.
          </div>
          <LayerNote currency={cur} />
        </Container>
      </div>
    </>
  );
}
