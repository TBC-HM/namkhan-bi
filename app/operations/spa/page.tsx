// app/operations/spa/page.tsx
// Re-restored 2026-05-05 — SlimHero · 2 KpiStrips · 3 cards · P&L grid · GL detail · trend · raw POS.

import FilterStrip from '@/components/nav/FilterStrip';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
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

  return (
    <Page
      eyebrow={`Operations · Spa · ${period.label}`}
      title={<>Wellness <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>treatments</em></>}
      subPages={OPERATIONS_SUBPAGES}
      topRight={<FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="Cloudbeds · live" />}
    >

      <KpiStrip items={[
        { label: 'Spa Revenue',    value: Number(a30?.spa_revenue ?? 0), kind: 'money', tone: 'pos' },
        { label: 'Spa / Occ Rn',   value: perOccRn, kind: 'money', tone: perOccRn >= 25 ? 'pos' : 'warn', hint: 'benchmark $25-40' },
        { label: 'Capture %',      value: captureRate, kind: 'pct', hint: 'benchmark ≥ 35%' },
        { label: 'Treatments / day', value: recent30 ? Number(recent30.avg_per_day) : 0, kind: 'count', hint: 'latest month' },
        { label: 'Months',         value: tileSrc ? tileSrc.months_used.length : 0, kind: 'count', hint: tileSrc ? tileSrc.months_used[0] : '—' },
        { label: 'Therapist util', value: 0, kind: 'pct', hint: 'scheduler not synced' },
      ] satisfies KpiStripItem[]} />

      <KpiStrip items={[
        { label: 'Spa Cost %', value: tileSrc ? tileSrc.spa_cost_pct : 0, kind: 'pct', tone: tileSrc && tileSrc.spa_cost_pct <= 12 ? 'pos' : 'warn', hint: 'target ≤ 12%' },
        { label: 'Labor %',    value: tileSrc ? tileSrc.labor_cost_pct : 0, kind: 'pct', tone: tileSrc && tileSrc.labor_cost_pct <= 35 ? 'pos' : 'neg', hint: 'target ≤ 35%' },
        { label: 'GOP %',      value: tileSrc ? tileSrc.gop_pct : 0, kind: 'pct', tone: tileSrc && tileSrc.gop_pct >= 50 ? 'pos' : tileSrc && tileSrc.gop_pct >= 0 ? 'warn' : 'neg', hint: 'target ≥ 50%' },
        { label: 'Revenue (QB)', value: tileSrc ? tileSrc.revenue : 0, kind: 'money', hint: tileSrc ? `${tileSrc.months_used.length} mo` : '—' },
        { label: 'Spa COGS',   value: tileSrc ? tileSrc.spa_cost : 0, kind: 'money' },
        { label: 'Payroll',    value: tileSrc ? tileSrc.payroll : 0, kind: 'money' },
      ] satisfies KpiStripItem[]} />

      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Monthly trend · revenue · costs · GOP %</h2>
      <DeptTrendChart rows={pl} dept="spa" />

      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>P&amp;L · QB GL · USALI rollup</h2>
      <PnlGrid rows={pl} dept="spa" targets={{ spa_cost_pct: 12, labor_cost_pct: 35, gop_pct: 50 }} defaultRows={6} />

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          GL detail · Spa accounts ▾
        </summary>
        <FnbGlBreakdown data={glBreakdown} defaultMonths={4} />
      </details>

      <details style={{ marginTop: 24 }} open>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          Top spa treatments · trend since Jan 26 ▾
        </summary>
        <FnbTopSellerTrend data={topTrend} />
      </details>

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          All POS transactions · search &amp; reconcile ▾  <span style={{ color: 'var(--ink-soft)', textTransform: 'none', letterSpacing: 'normal' }}>({rawTxns.length} most recent)</span>
        </summary>
        <FnbRawTransactions data={rawTxns} pageSize={200} />
      </details>
    </Page>
  );
}
