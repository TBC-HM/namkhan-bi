// app/revenue/reports/render/_renderers/PlMonthReport.tsx
// USALI P&L month report — ported to primitives.

import { Container, KpiTile, Chart, type ChartSeries } from '@/app/(cockpit)/_design';
import ReportBrief from './_shared/ReportBrief';
import { getUsaliHouse, getUsaliDept } from '@/app/finance/_data';
import type { ResolvedPeriod } from '@/lib/period';
import { fmtTableUsd } from '@/lib/format';

interface Props {
  period: ResolvedPeriod;
  month?: string;
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
  let target: string;
  if (month && MONTH_RE.test(month)) {
    target = month;
  } else {
    const d = new Date(period.to + 'T00:00:00Z');
    target = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const prior = priorMonth(target);
  const ly = (() => {
    const [y, m] = target.split('-').map(Number);
    return `${y - 1}-${String(m).padStart(2, '0')}`;
  })();

  const periods = [target, prior, ly];
  const [house, dept] = await Promise.all([
    getUsaliHouse(periods).catch(() => [] as Array<Record<string, unknown>>),
    getUsaliDept(periods).catch(() => [] as Array<Record<string, unknown>>),
  ]);

  const hCur   = house.find((r) => r.period_yyyymm === target) ?? null;
  const hPrior = house.find((r) => r.period_yyyymm === prior)  ?? null;
  const hLy    = house.find((r) => r.period_yyyymm === ly)     ?? null;

  if (!hCur && dept.filter((d) => d.period_yyyymm === target).length === 0) {
    return (
      <Container title="No data" subtitle={`gl.v_usali_house_summary returned no rows for ${target}`} density="compact">
        <div style={{ padding: 20, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          Try a different month or check the upstream GL feed.
        </div>
      </Container>
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

  const briefSignal = `${target} · Total revenue $${totalRev.toLocaleString(undefined, { maximumFractionDigits: 0 })} · GOP $${gop.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${gopPct.toFixed(0)}%)`;
  const briefBody = `MoM ${revMomPct >= 0 ? '+' : ''}${revMomPct.toFixed(1)}% · YoY ${revYoyPct >= 0 ? '+' : ''}${revYoyPct.toFixed(1)}%.`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (gopPct >= 30)    good.push(`GOP margin ${gopPct.toFixed(0)}% — healthy.`);
  if (gopPct <  20)    bad.push (`GOP margin ${gopPct.toFixed(0)}% — thin; review costs.`);
  if (revMomPct >= 5)  good.push(`Revenue +${revMomPct.toFixed(0)}% MoM.`);
  if (revMomPct <= -5) bad.push (`Revenue ${revMomPct.toFixed(0)}% MoM — investigate softness.`);
  if (revYoyPct >= 5)  good.push(`Revenue +${revYoyPct.toFixed(0)}% YoY.`);
  if (revYoyPct <= -5) bad.push (`Revenue ${revYoyPct.toFixed(0)}% YoY — vs same month last year.`);
  if (good.length === 0) good.push('No standout strengths flagged this month.');
  if (bad.length === 0)  bad.push ('No structural risks flagged this month.');

  const deptCur = dept.filter((d) => d.period_yyyymm === target);

  const revRows = [
    { metric: 'Total revenue',
      target: fmtTableUsd(totalRev), prior: fmtTableUsd(priorRev),
      dmom: fmtTableUsd(dRevMom),
      ly: fmtTableUsd(lyRev), dyoy: fmtTableUsd(dRevYoy) },
    { metric: 'GOP',
      target: fmtTableUsd(gop), prior: fmtTableUsd(Number(hPrior?.gop ?? 0)),
      dmom: fmtTableUsd(gop - Number(hPrior?.gop ?? 0)),
      ly: fmtTableUsd(Number(hLy?.gop ?? 0)),
      dyoy: fmtTableUsd(gop - Number(hLy?.gop ?? 0)) },
    { metric: 'Net income',
      target: fmtTableUsd(net), prior: fmtTableUsd(Number(hPrior?.net_income ?? 0)),
      dmom: fmtTableUsd(net - Number(hPrior?.net_income ?? 0)),
      ly: fmtTableUsd(Number(hLy?.net_income ?? 0)),
      dyoy: fmtTableUsd(net - Number(hLy?.net_income ?? 0)) },
  ];
  const revCols: ChartSeries[] = [
    { key: 'target', label: target },
    { key: 'prior',  label: prior },
    { key: 'dmom',   label: 'Δ MoM' },
    { key: 'ly',     label: ly },
    { key: 'dyoy',   label: 'Δ YoY' },
  ];

  const deptRows = deptCur.map((d, i) => ({
    department: String(d.usali_department ?? `Row ${i + 1}`),
    revenue: fmtTableUsd(Number(d.revenue ?? 0)),
    cogs: fmtTableUsd(Number(d.cost_of_sales ?? 0)),
    payroll: fmtTableUsd(Number(d.payroll ?? 0)),
    other: fmtTableUsd(Number(d.other_op_exp ?? 0)),
    profit: fmtTableUsd(Number(d.departmental_profit ?? 0)),
    margin: d.dept_profit_margin != null ? `${Number(d.dept_profit_margin).toFixed(1)}%` : '—',
  }));
  const deptCols: ChartSeries[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'cogs',    label: 'COGS' },
    { key: 'payroll', label: 'Payroll' },
    { key: 'other',   label: 'Other OE' },
    { key: 'profit',  label: 'Dept profit' },
    { key: 'margin',  label: 'Margin %' },
  ];

  return (
    <>
      <ReportBrief signal={briefSignal} body={briefBody} good={good} bad={bad} />

      <Container title={`USALI P&L · ${target}`} subtitle="house summary" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiTile label="Total revenue" value={Math.round(totalRev)} currency="USD" size="sm"
            delta={priorRev > 0 ? { value: revMomPct, period: 'MoM', direction: dRevMom >= 0 ? 'up' : 'down' } : undefined} />
          <KpiTile label="Cost of sales" value={Math.round(cogs)} currency="USD" size="sm" />
          <KpiTile label="Payroll" value={Math.round(payroll)} currency="USD" size="sm" />
          <KpiTile label="A&G" value={Math.round(ag)} currency="USD" size="sm" />
          <KpiTile label="Utilities" value={Math.round(utilities)} currency="USD" size="sm" />
          <KpiTile label="GOP" value={Math.round(gop)} currency="USD" size="sm"
            footnote={`margin ${gopPct.toFixed(1)}%`}
            status={gopPct >= 30 ? 'green' : gopPct < 20 ? 'red' : 'amber'} />
          <KpiTile label="Net income" value={Math.round(net)} currency="USD" size="sm" />
        </div>
      </Container>

      <Container title="Revenue MoM / YoY" subtitle={`${target} vs ${prior} · vs ${ly}`}>
        <Chart variant="table" data={revRows} xKey="metric" series={revCols}
          empty={{ title: 'No comparison data' }} />
      </Container>

      <Container title="Departmental detail" subtitle={`${deptCur.length} department${deptCur.length === 1 ? '' : 's'}`}>
        <Chart variant="table" data={deptRows} xKey="department" series={deptCols}
          empty={{ title: 'No departmental rows', hint: `for ${target}` }} />
      </Container>
    </>
  );
}
