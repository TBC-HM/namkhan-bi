// app/operations/restaurant/page.tsx
// Operations · F&B — re-restored 2026-05-05 after parallel-session wipe.
// SlimHero · 2 KpiStrip rows (Operating + USALI Effective) · 3 explainer cards
// (Staff Canteen · Breakfast allocation · Menu engineering coming-soon) · P&L grid
// · GL detail (collapsed) · Top-seller trend · raw POS list.

import FilterStrip from '@/components/nav/FilterStrip';
import KpiStrip, { type KpiStripItem } from '@/components/kpi/KpiStrip';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import PnlGrid from '@/components/pl/PnlGrid';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import FnbGlBreakdown from '@/components/pl/FnbGlBreakdown';
import FnbTopSellerTrend from '@/components/pl/FnbTopSellerTrend';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import {
  getKpiDaily, aggregateDaily, getDeptPl, getFnbCovers,
  getFnbCostsForPeriod, getFnbCaptureForPeriod, getCanteenForPeriod,
  getFnbGlBreakdown, getFnbTopSellerTrend, getBreakfastAllocation, getFnbRawTransactions,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function FnbPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const [daily, pl, periodCosts, captureP, canteen, glBreakdown, topTrend, rawTxns, bkfst, covers] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getDeptPl('fnb', 16).catch(() => []),
    getFnbCostsForPeriod(period.from, period.to).catch(() => null),
    getFnbCaptureForPeriod(period.from, period.to).catch(() => null),
    getCanteenForPeriod(period.from, period.to).catch(() => null),
    getFnbGlBreakdown(16).catch(() => ({ periods: [], lines: [] })),
    getFnbTopSellerTrend('2026-01-01', 8).catch(() => ({ periods: [], items: [] })),
    getFnbRawTransactions(2000).catch(() => []),
    getBreakfastAllocation(period.from, period.to).catch(() => null),
    getFnbCovers(period.from, period.to).catch(() => null),
  ]);
  const a30 = aggregateDaily(daily, period.capacityMode);
  const plLatest = pl.find(r => r.revenue > 0) ?? null;
  const tileSrc = periodCosts ?? (plLatest ? {
    revenue: plLatest.revenue, food_revenue: plLatest.food_revenue, bev_revenue: plLatest.bev_revenue,
    food_cost: plLatest.food_cost, bev_cost: plLatest.bev_cost, payroll: plLatest.payroll,
    total_cost: plLatest.total_cost, gop: plLatest.gop,
    food_cost_pct: plLatest.food_cost_pct, bev_cost_pct: plLatest.bev_cost_pct,
    labor_cost_pct: plLatest.labor_cost_pct, gop_pct: plLatest.gop_pct,
    months_used: [plLatest.period],
  } : null);
  const effectiveFnbRev = (tileSrc?.revenue ?? 0) + (bkfst?.total_alloc_usd ?? 0);
  const effectiveLaborPct = effectiveFnbRev > 0 && tileSrc ? (tileSrc.payroll / effectiveFnbRev) * 100 : null;
  const effectiveGopUsd = tileSrc ? (effectiveFnbRev - tileSrc.total_cost) : null;
  const effectiveGopPct = effectiveFnbRev > 0 && effectiveGopUsd != null ? (effectiveGopUsd / effectiveFnbRev) * 100 : null;

  return (
    <Page
      eyebrow={`Operations · F&B · ${period.label}`}
      title={<>Roots <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>restaurant</em></>}
      subPages={OPERATIONS_SUBPAGES}
      topRight={<FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="Cloudbeds · live" />}
    >

      {/* Row 1 — Operating snapshot */}
      <KpiStrip items={[
        { label: 'F&B / Occ Rn',  value: captureP ? Number(captureP.spend_per_occ) : 0, kind: 'money', tone: 'pos', hint: captureP ? period.label : 'no data — try 30d+' },
        { label: 'Capture %',     value: captureP ? Number(captureP.capture_pct)   : 0, kind: 'pct', hint: captureP ? `${captureP.res_with_purchase}/${captureP.res_in_house} res` : 'no data' },
        { label: 'Food Rev',      value: Number(a30?.fnb_food_revenue ?? 0), kind: 'money' },
        { label: 'Beverage Rev',  value: Number(a30?.fnb_beverage_revenue ?? 0), kind: 'money' },
        { label: 'Staff Canteen', value: Number(canteen?.total_usd ?? 0), kind: 'money' },
        { label: 'Canteen / Occ', value: Number(canteen?.cost_per_occ_room ?? 0), kind: 'money' },
      ] satisfies KpiStripItem[]} />

      {/* Row 2 — USALI Effective view */}
      <KpiStrip items={[
        { label: 'Breakfast alloc',    value: Number(bkfst?.total_alloc_usd ?? 0), kind: 'money', hint: 'USALI fair value' },
        { label: 'Effective F&B Rev',  value: effectiveFnbRev, kind: 'money', tone: 'pos' },
        { label: 'Effective GOP $',    value: Number(effectiveGopUsd ?? 0), kind: 'money',
          tone: effectiveGopUsd != null && effectiveGopUsd > 0 ? 'pos' : 'neg' },
        { label: 'Effective GOP %',    value: Number(effectiveGopPct ?? 0), kind: 'pct',
          tone: effectiveGopPct != null && effectiveGopPct >= 25 ? 'pos' : 'warn', hint: 'target ≥ 25%' },
        { label: 'Eff Labor %',        value: Number(effectiveLaborPct ?? 0), kind: 'pct', hint: 'target ≤ 35%' },
        { label: 'Eff Food %',         value: effectiveFnbRev > 0 && tileSrc ? (tileSrc.food_cost / effectiveFnbRev) * 100 : 0, kind: 'pct', hint: 'target ≤ 30%' },
      ] satisfies KpiStripItem[]} />

      {/* 3 explainer panels — wrapped in canonical <Panel> for dark canvas (PBS 2026-05-09) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 12 }}>
        <Panel title="Staff canteen" eyebrow={period.label} hideExpander>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', lineHeight: 1.15, color: 'var(--brass-pale)' }}>
            ${canteen ? Math.round(canteen.total_usd).toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-faint)', lineHeight: 1.4 }}>
            <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>EMPLOYEE MEAL</code> + <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>STAFF CANTEEN MATERIALS</code> across all depts.
          </div>
          {canteen && canteen.by_dept.length > 0 && (
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
              By dept: {canteen.by_dept.map(d => `${d.dept} $${Math.round(d.usd).toLocaleString()}`).join(' · ')}
            </div>
          )}
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--oxblood-soft)', background: 'rgba(181, 58, 42, 0.12)', padding: '6px 8px', borderLeft: '2px solid #ff8a8a', marginTop: 4 }}>
            <strong>Watch:</strong> Mar / Apr 2026 reclassified F&amp;B → Undistributed. The &quot;labor drop&quot; is a posting reclass, not a real saving.
          </div>
        </Panel>

        <Panel title="Breakfast allocation · USALI" eyebrow="rooms → f&b" hideExpander>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', lineHeight: 1.15, color: 'var(--brass-pale)' }}>
            ${bkfst ? Math.round(bkfst.total_alloc_usd).toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-faint)', lineHeight: 1.4 }}>
            {bkfst ? <>{bkfst.adult_nights} adult-nights × $10 + {bkfst.child_nights} child-nights × $5 (fair value).</> : 'Pax-nights × $10/adult + $5/child.'}
            {' '}Configurable via <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>BREAKFAST_USD_ADULT</code>.
          </div>
          {effectiveLaborPct != null && tileSrc && (
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
              Labor% drops {tileSrc.labor_cost_pct.toFixed(1)}% → {effectiveLaborPct.toFixed(1)}% if JE applied.
            </div>
          )}
          <div style={{ fontSize: 'var(--t-xs)', color: '#86d39c', background: 'rgba(44, 122, 75, 0.14)', padding: '6px 8px', borderLeft: '2px solid #86d39c', marginTop: 4 }}>
            <strong>Action:</strong> Monthly QB JE — <code style={{ fontFamily: 'var(--mono)' }}>DR Rooms Rev · CR Food Rev</code>. Zero P&amp;L impact, USALI-clean.
          </div>
        </Panel>

        <Panel title="Menu engineering" eyebrow="coming soon" hideExpander>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', lineHeight: 1.15, color: 'var(--brass-pale)', opacity: 0.8 }}>Stars · Plowhorses · Puzzles · Dogs</div>
          <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-faint)', lineHeight: 1.4 }}>
            Each dish on popularity × profitability. Needs POS qty + recipe sheets in <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>inv.recipes</code>.
          </div>
        </Panel>
      </div>

      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>Monthly trend · revenue · costs · GOP %</h2>
      <DeptTrendChart rows={pl} dept="fnb" />

      <h2 style={{ marginTop: 28, marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>P&amp;L · QB GL · USALI rollup</h2>
      <PnlGrid rows={pl} dept="fnb" targets={{ food_cost_pct: 30, bev_cost_pct: 25, labor_cost_pct: 35, gop_pct: 25 }} defaultRows={6} />

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          GL detail · F&amp;B accounts (every QB line) ▾
        </summary>
        <FnbGlBreakdown data={glBreakdown} defaultMonths={4} />
      </details>

      <details style={{ marginTop: 24 }} open>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', padding: '8px 0' }}>
          Top sellers · trend since Jan 26 ▾
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
