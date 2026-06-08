// app/operations/spa/page.tsx
// PBS 2026-06-09 #136 — B&W primitives reskin. Same layout, same dynamic data.

import FilterStrip from '@/components/nav/FilterStrip';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import PnlGrid from '@/components/pl/PnlGrid';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import FnbGlBreakdown from '@/components/pl/FnbGlBreakdown';
import FnbTopSellerTrend from '@/components/pl/FnbTopSellerTrend';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import {
  getKpiDaily, aggregateDaily, getDeptPl, getSpaTreatments,
  getDeptCaptureForPeriod, getSpaCostsForPeriod,
  getDeptGlBreakdown, getDeptTopSellerTrend, getDeptRawTransactions,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

export default async function SpaPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const [daily, pl, periodCosts, captureP, glBreakdown, topTrend, rawTxns, spa12] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getDeptPl('spa', 16).catch(() => []),
    getSpaCostsForPeriod(period.from, period.to).catch(() => null),
    getDeptCaptureForPeriod({ usali_dept: 'Other Operated', usali_subdept: 'Spa' }, period.from, period.to).catch(() => null),
    getDeptGlBreakdown('Spa', 16).catch(() => ({ periods: [], lines: [] })),
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Spa' }, '2026-01-01', 8).catch(() => ({ periods: [], items: [] })),
    getDeptRawTransactions({ usali_dept: 'Other Operated', usali_subdept: 'Spa' }, 2000).catch(() => []),
    getSpaTreatments(12).catch(() => null),
  ]);
  const a30 = aggregateDaily(daily, period.capacityMode);
  const plLatest = pl.find(r => r.revenue > 0) ?? null;
  const tileSrc = periodCosts ?? (plLatest ? {
    revenue: plLatest.revenue, spa_cost: plLatest.spa_cost, payroll: plLatest.payroll,
    total_cost: plLatest.total_cost, gop: plLatest.gop,
    spa_cost_pct: plLatest.spa_cost_pct, labor_cost_pct: plLatest.labor_cost_pct, gop_pct: plLatest.gop_pct,
    months_used: [plLatest.period],
  } : null);
  const captureRate = captureP ? Number(captureP.capture_pct) : 0;
  const perOccRn = captureP ? Number(captureP.spend_per_occ) : 0;
  const recent30 = spa12?.by_month?.[spa12.by_month.length - 1];

  const row1: KpiTileProps[] = [
    { label: 'Spa Revenue',    value: fmtUsd(Number(a30?.spa_revenue ?? 0)), status: 'green', size: 'sm' },
    { label: 'Spa / Occ Rn',   value: fmtUsd(perOccRn), footnote: 'benchmark $25-40',
      status: (perOccRn >= 25 ? 'green' : 'amber') as 'green'|'amber', size: 'sm' },
    { label: 'Capture %',      value: fmtPct(captureRate), footnote: 'benchmark ≥ 35%', status: 'grey', size: 'sm' },
    { label: 'Treatments / day', value: recent30 ? Number(recent30.avg_per_day) : 0, footnote: 'latest month', status: 'grey', size: 'sm' },
    { label: 'Months',         value: tileSrc ? tileSrc.months_used.length : 0, footnote: tileSrc ? tileSrc.months_used[0] : '—', status: 'grey', size: 'sm' },
    { label: 'Therapist util', value: '0%', footnote: 'scheduler not synced', status: 'grey', size: 'sm' },
  ];

  const row2: KpiTileProps[] = [
    { label: 'Spa Cost %', value: fmtPct(tileSrc ? tileSrc.spa_cost_pct : 0), footnote: 'target ≤ 12%',
      status: (tileSrc && tileSrc.spa_cost_pct <= 12 ? 'green' : 'amber') as 'green'|'amber', size: 'sm' },
    { label: 'Labor %',    value: fmtPct(tileSrc ? tileSrc.labor_cost_pct : 0), footnote: 'target ≤ 35%',
      status: (tileSrc && tileSrc.labor_cost_pct <= 35 ? 'green' : 'red') as 'green'|'red', size: 'sm' },
    { label: 'GOP %',      value: fmtPct(tileSrc ? tileSrc.gop_pct : 0), footnote: 'target ≥ 50%',
      status: (tileSrc && tileSrc.gop_pct >= 50 ? 'green' : tileSrc && tileSrc.gop_pct >= 0 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
    { label: 'Revenue (QB)', value: fmtUsd(tileSrc ? tileSrc.revenue : 0), footnote: tileSrc ? `${tileSrc.months_used.length} mo` : '—', status: 'grey', size: 'sm' },
    { label: 'Spa COGS',   value: fmtUsd(tileSrc ? tileSrc.spa_cost : 0), status: 'grey', size: 'sm' },
    { label: 'Payroll',    value: fmtUsd(tileSrc ? tileSrc.payroll : 0), status: 'grey', size: 'sm' },
  ];

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/spa') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  return (
    <DashboardPage
      title={`Wellness treatments · ${period.label}`}
      subtitle="Operations · Spa · live from QB GL + PMS · USALI rollup"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle="revenue · capture · treatments — current period" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Cost discipline · USALI" subtitle="targets: spa cost ≤12% · labor ≤35% · GOP ≥50%" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row2.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="PMS · live" />

        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="last 16 months — live from gl.v_dept_pl_namkhan">
          <DeptTrendChart rows={pl} dept="spa" />
        </Container>

        <Container title="P&L · QB GL · USALI rollup" subtitle="targets: spa cost ≤12% · labor ≤35% · GOP ≥50%">
          <PnlGrid rows={pl} dept="spa" targets={{ spa_cost_pct: 12, labor_cost_pct: 35, gop_pct: 50 }} defaultRows={6} />
        </Container>

        <details>
          <summary style={summaryStyle}>GL detail · Spa accounts</summary>
          <div style={{ marginTop: 10 }}>
            <FnbGlBreakdown data={glBreakdown} defaultMonths={4} />
          </div>
        </details>

        <details open>
          <summary style={summaryStyle}>Top spa treatments · trend since Jan 26</summary>
          <div style={{ marginTop: 10 }}>
            <FnbTopSellerTrend data={topTrend} />
          </div>
        </details>

        <details>
          <summary style={summaryStyle}>All POS transactions · search &amp; reconcile <span style={{ fontWeight: 400, color: '#5A5A5A', marginLeft: 6 }}>({rawTxns.length} most recent)</span></summary>
          <div style={{ marginTop: 10 }}>
            <FnbRawTransactions data={rawTxns} pageSize={200} />
          </div>
        </details>
      </div>
    </DashboardPage>
  );
}
