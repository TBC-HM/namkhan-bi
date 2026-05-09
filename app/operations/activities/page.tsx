// app/operations/activities/page.tsx
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
  getKpiDaily, aggregateDaily, getDeptPl,
  getDeptCaptureForPeriod, getActivitiesCostsForPeriod,
  getDeptGlBreakdown, getDeptTopSellerTrend, getDeptRawTransactions,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { supabase, PROPERTY_ID } from '@/lib/supabase';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function ActivitiesPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  const [daily, pl, periodCosts, captureP, glBreakdown, topTrend, rawTxns, transportRow] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getDeptPl('activities', 16).catch(() => []),
    getActivitiesCostsForPeriod(period.from, period.to).catch(() => null),
    getDeptCaptureForPeriod({ usali_dept: 'Other Operated', usali_subdept: 'Activities' }, period.from, period.to).catch(() => null),
    getDeptGlBreakdown('Activities', 16).catch(() => ({ periods: [], lines: [] })),
    getDeptTopSellerTrend({ usali_dept: 'Other Operated', usali_subdept: 'Activities' }, '2026-01-01', 8).catch(() => ({ periods: [], items: [] })),
    getDeptRawTransactions({ usali_dept: 'Other Operated', usali_subdept: 'Activities' }, 2000).catch(() => []),
    supabase
      .from('mv_classified_transactions')
      .select('amount')
      .eq('property_id', PROPERTY_ID)
      .eq('usali_dept', 'Other Operated')
      .eq('usali_subdept', 'Transportation')
      .gte('transaction_date', period.from)
      .lte('transaction_date', period.to)
      .then(r => ({ data: r.data ?? [] })),
  ]);

  const a30 = aggregateDaily(daily, period.capacityMode);
  const plLatest = pl.find(r => r.revenue > 0) ?? null;
  const tileSrc = periodCosts ?? (plLatest ? {
    revenue: plLatest.revenue, total_cost: plLatest.total_cost, payroll: plLatest.payroll,
    gop: plLatest.gop, labor_cost_pct: plLatest.labor_cost_pct, gop_pct: plLatest.gop_pct,
    months_used: [plLatest.period],
  } : null);
  const captureRate = captureP ? Number(captureP.capture_pct) : 0;
  const perOccRn = captureP ? Number(captureP.spend_per_occ) : 0;
  const transportRev = (transportRow.data ?? []).reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  return (
    <Page
      eyebrow={`Operations · Activities · ${period.label}`}
      title={<>Excursions <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>&amp; experiences</em></>}
      subPages={OPERATIONS_SUBPAGES}
      topRight={<FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="Cloudbeds · live" />}
    >

      <KpiStrip items={[
        { label: 'Activity Revenue', value: Number(a30?.activity_revenue ?? 0), kind: 'money', tone: 'pos' },
        { label: 'Activity / Occ Rn', value: perOccRn, kind: 'money', tone: perOccRn >= 20 ? 'pos' : 'warn', hint: 'benchmark $20-35' },
        { label: 'Capture %', value: captureRate, kind: 'pct', tone: captureRate >= 30 ? 'pos' : captureRate >= 15 ? 'warn' : 'neg', hint: 'benchmark 30%+' },
        { label: 'Transport Revenue', value: transportRev, kind: 'money', hint: 'airport · transfers' },
        { label: 'Months', value: tileSrc ? tileSrc.months_used.length : 0, kind: 'count', hint: tileSrc ? tileSrc.months_used[0] : '—' },
        { label: 'Supplier margin', value: 0, kind: 'pct', hint: 'supplier ledger not synced' },
      ] satisfies KpiStripItem[]} />

      <KpiStrip items={[
        { label: 'Labor %', value: tileSrc ? tileSrc.labor_cost_pct : 0, kind: 'pct', tone: tileSrc && tileSrc.labor_cost_pct <= 35 ? 'pos' : 'neg', hint: 'target ≤ 35%' },
        { label: 'GOP %', value: tileSrc ? tileSrc.gop_pct : 0, kind: 'pct', tone: tileSrc && tileSrc.gop_pct >= 50 ? 'pos' : tileSrc && tileSrc.gop_pct >= 0 ? 'warn' : 'neg', hint: 'target ≥ 50%' },
        { label: 'Revenue (QB)', value: tileSrc ? tileSrc.revenue : 0, kind: 'money', hint: tileSrc ? `${tileSrc.months_used.length} mo` : '—' },
        { label: 'Total cost', value: tileSrc ? tileSrc.total_cost : 0, kind: 'money' },
        { label: 'Payroll', value: tileSrc ? tileSrc.payroll : 0, kind: 'money' },
        { label: 'GOP', value: tileSrc ? tileSrc.gop : 0, kind: 'money', tone: tileSrc && tileSrc.gop >= 0 ? 'pos' : 'neg' },
      ] satisfies KpiStripItem[]} />

      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Monthly trend · revenue · costs · GOP %</h2>
      <DeptTrendChart rows={pl} dept="activities" />

      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>P&amp;L · QB GL · USALI rollup</h2>
      <PnlGrid rows={pl} dept="activities" targets={{ labor_cost_pct: 35, gop_pct: 50 }} defaultRows={6} />

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          GL detail · Activities accounts ▾
        </summary>
        <FnbGlBreakdown data={glBreakdown} defaultMonths={4} />
      </details>

      <details style={{ marginTop: 24 }} open>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          Top activities · trend since Jan 26 ▾
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
