// app/revenue/reports/render/_renderers/PlMonthReport.tsx
// USALI P&L for the picked month — pulls v_usali_house_summary +
// v_usali_dept_summary from the gl schema. Server component.
//
// URL contract:
//   /revenue/reports/render?type=pl-month&month=2026-04
// If `month` is missing or invalid we fall back to the latest closed month
// in the gl data; if that also fails we render an empty-state.

import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import Brief from '@/components/page/Brief';
import { getUsaliHouse, getUsaliDept } from '@/app/finance/_data';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props {
  period: ResolvedPeriod;
  month?: string; // 2026-04
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function priorMonth(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr); const m = Number(mStr);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

export default async function PlMonthReport({ period, month }: Props) {
  // Resolve target month: explicit param wins; else last full calendar month
  // before period.to (so default 30d windows still produce a useful month).
  let target: string;
  if (month && MONTH_RE.test(month)) {
    target = month;
  } else {
    const d = new Date(period.to + 'T00:00:00Z');
    // Use the period.to month (it's the most relevant for "this month's P&L").
    target = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const prior = priorMonth(target);
  const ly = (() => {
    const [y, m] = target.split('-').map(Number);
    return `${y - 1}-${String(m).padStart(2, '0')}`;
  })();

  const periods = [target, prior, ly];
  const [house, dept] = await Promise.all([
    getUsaliHouse(periods).catch(() => []),
    getUsaliDept(periods).catch(() => []),
  ]);

  const hCur   = house.find(r => r.period_yyyymm === target) ?? null;
  const hPrior = house.find(r => r.period_yyyymm === prior)  ?? null;
  const hLy    = house.find(r => r.period_yyyymm === ly)     ?? null;

  // No data → empty state
  if (!hCur && dept.filter(d => d.period_yyyymm === target).length === 0) {
    return (
      <div data-panel style={{
        padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center',
        background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 10,
      }}>
        No P&L data for {target}. gl.v_usali_house_summary returned no rows for this month.
      </div>
    );
  }

  const totalRev = Number(hCur?.total_revenue ?? 0);
  const cogs     = Number(hCur?.total_cost_of_sales ?? 0);
  const payroll  = Number(hCur?.total_dept_payroll ?? 0);
  const ag       = Number(hCur?.ag_total ?? 0);
  const utilities = Number(hCur?.utilities ?? 0);
  const gop      = Number(hCur?.gop ?? 0);
  const net      = Number(hCur?.net_income ?? 0);

  const priorRev = Number(hPrior?.total_revenue ?? 0);
  const lyRev    = Number(hLy?.total_revenue ?? 0);
  const dRevMom = totalRev - priorRev;
  const dRevYoy = totalRev - lyRev;
  const revMomPct = priorRev > 0 ? ((totalRev - priorRev) / priorRev) * 100 : 0;
  const revYoyPct = lyRev    > 0 ? ((totalRev - lyRev   ) / lyRev   ) * 100 : 0;
  const gopPct = totalRev > 0 ? (gop / totalRev) * 100 : 0;

  const briefSignal =
    `${target} · Total revenue $${totalRev.toLocaleString(undefined, { maximumFractionDigits: 0 })} · ` +
    `GOP $${gop.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${gopPct.toFixed(0)}%)`;
  const briefBody =
    `MoM ${revMomPct >= 0 ? '+' : ''}${revMomPct.toFixed(1)}% · ` +
    `YoY ${revYoyPct >= 0 ? '+' : ''}${revYoyPct.toFixed(1)}%.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (gopPct >= 30)   good.push(`GOP margin ${gopPct.toFixed(0)}% — healthy.`);
  if (gopPct <  20)   bad.push (`GOP margin ${gopPct.toFixed(0)}% — thin; review costs.`);
  if (revMomPct >= 5) good.push(`Revenue +${revMomPct.toFixed(0)}% MoM.`);
  if (revMomPct <= -5) bad.push (`Revenue ${revMomPct.toFixed(0)}% MoM — investigate softness.`);
  if (revYoyPct >= 5) good.push(`Revenue +${revYoyPct.toFixed(0)}% YoY.`);
  if (revYoyPct <= -5) bad.push (`Revenue ${revYoyPct.toFixed(0)}% YoY — vs same month last year.`);
  if (good.length === 0) good.push('No standout strengths flagged this month.');
  if (bad.length === 0)  bad.push ('No structural risks flagged this month.');

  // Department detail rows (current month only)
  const deptCur = dept.filter(d => d.period_yyyymm === target);

  return (
    <>
      <Brief brief={{ signal: briefSignal, body: briefBody, good, bad }} actions={null} />

      <div style={{ height: 14 }} />

      <Panel title={`USALI P&L · ${target}`} eyebrow="house summary" hideExpander>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox value={totalRev} unit="usd" label="Total revenue"
            compare={{ value: dRevMom, unit: 'usd', period: 'MoM' }} />
          <KpiBox value={cogs}     unit="usd" label="Cost of sales" />
          <KpiBox value={payroll}  unit="usd" label="Payroll" />
          <KpiBox value={ag}       unit="usd" label="A&G" />
          <KpiBox value={utilities} unit="usd" label="Utilities" />
          <KpiBox value={gop}      unit="usd" label="GOP"
            compare={{ value: gopPct, unit: 'pct', period: 'margin' }} />
          <KpiBox value={net}      unit="usd" label="Net income" />
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Revenue MoM / YoY" eyebrow={`${target} vs ${prior} · vs ${ly}`} hideExpander>
        <table className="tbl">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num">{target}</th>
              <th className="num">{prior}</th>
              <th className="num">Δ MoM</th>
              <th className="num">{ly}</th>
              <th className="num">Δ YoY</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="lbl">Total revenue</td>
              <td className="num">{fmtTableUsd(totalRev)}</td>
              <td className="num">{fmtTableUsd(priorRev)}</td>
              <td className="num">{fmtTableUsd(dRevMom)}</td>
              <td className="num">{fmtTableUsd(lyRev)}</td>
              <td className="num">{fmtTableUsd(dRevYoy)}</td>
            </tr>
            <tr>
              <td className="lbl">GOP</td>
              <td className="num">{fmtTableUsd(gop)}</td>
              <td className="num">{fmtTableUsd(Number(hPrior?.gop ?? 0))}</td>
              <td className="num">{fmtTableUsd(gop - Number(hPrior?.gop ?? 0))}</td>
              <td className="num">{fmtTableUsd(Number(hLy?.gop ?? 0))}</td>
              <td className="num">{fmtTableUsd(gop - Number(hLy?.gop ?? 0))}</td>
            </tr>
            <tr>
              <td className="lbl">Net income</td>
              <td className="num">{fmtTableUsd(net)}</td>
              <td className="num">{fmtTableUsd(Number(hPrior?.net_income ?? 0))}</td>
              <td className="num">{fmtTableUsd(net - Number(hPrior?.net_income ?? 0))}</td>
              <td className="num">{fmtTableUsd(Number(hLy?.net_income ?? 0))}</td>
              <td className="num">{fmtTableUsd(net - Number(hLy?.net_income ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Departmental detail" eyebrow={`${deptCur.length} departments`} hideExpander>
        {deptCur.length === 0 ? (
          <div style={{ padding: 20, color: '#7d7565', fontStyle: 'italic' }}>
            No departmental rows for {target}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="num">Revenue</th>
                  <th className="num">COGS</th>
                  <th className="num">Payroll</th>
                  <th className="num">Other OE</th>
                  <th className="num">Dept profit</th>
                  <th className="num">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {deptCur.map((d, i) => (
                  <tr key={`${d.usali_department}-${i}`}>
                    <td className="lbl">{d.usali_department}</td>
                    <td className="num">{fmtTableUsd(Number(d.revenue ?? 0))}</td>
                    <td className="num">{fmtTableUsd(Number(d.cost_of_sales ?? 0))}</td>
                    <td className="num">{fmtTableUsd(Number(d.payroll ?? 0))}</td>
                    <td className="num">{fmtTableUsd(Number(d.other_op_exp ?? 0))}</td>
                    <td className="num">{fmtTableUsd(Number(d.departmental_profit ?? 0))}</td>
                    <td className="num">
                      {d.dept_profit_margin != null ? `${Number(d.dept_profit_margin).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
