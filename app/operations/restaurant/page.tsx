// app/operations/restaurant/page.tsx
// PBS 2026-06-08 #136 — B&W primitives reskin. Legacy Page+KpiStrip+Panel swept
// to DashboardPage+Container+KpiTile. Layout, data sources, and collapsible
// sections preserved 1:1. All numbers still live from /lib/data fetchers.

import FilterStrip from '@/components/nav/FilterStrip';
import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
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
import { supabase } from '@/lib/supabase';

interface GlLineRow { usali_line_label: string; amount_usd: number | string | null }

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

export default async function FnbPage({ searchParams }: Props) {
  // PBS 2026-06-09 #143 — independent period drilldown for the Row 1 PMS strip.
  const OP_PERIODS = ['yesterday','7d','30d','ytd'] as const;
  type OpPeriod = typeof OP_PERIODS[number];
  const rawOp = String((searchParams ?? {}).op_period ?? '30d');
  const opPeriod: OpPeriod = (OP_PERIODS as readonly string[]).includes(rawOp) ? rawOp as OpPeriod : '30d';
  const opToday = new Date(); opToday.setUTCHours(0,0,0,0);
  const opToIso = opToday.toISOString().slice(0,10);
  const opFromIso = (() => {
    const d = new Date(opToday);
    if (opPeriod === 'yesterday') { d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10); }
    if (opPeriod === '7d')  { d.setUTCDate(d.getUTCDate() - 6);  return d.toISOString().slice(0,10); }
    if (opPeriod === '30d') { d.setUTCDate(d.getUTCDate() - 29); return d.toISOString().slice(0,10); }
    return `${opToday.getUTCFullYear()}-01-01`;
  })();
  const opEndIso = opPeriod === 'yesterday'
    ? (() => { const d = new Date(opToday); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10); })()
    : opToIso;
  const opLabel = opPeriod === 'yesterday' ? 'Yesterday' : opPeriod === '7d' ? 'Last 7 days' : opPeriod === '30d' ? 'Last 30 days' : 'YTD';

  const period = resolvePeriod(searchParams);
  // PBS 2026-06-09 #139 — QB GL post-April 2026 has empty F&B rows (reclass
  // to Undistributed). Scope the USALI Effective row + Staff Canteen to the
  // last fully-mapped quarter (Q1 2026) instead of the rolling window so the
  // tiles reflect a meaningful comparison instead of $0 / NaN.
  const Q1_FROM = '2026-01-01';
  const Q1_TO   = '2026-03-31';
  const Q1_LABEL = 'Q1 2026 (Jan-Mar) · last fully-mapped GL quarter';
  const [daily, pl, periodCosts, captureP, canteenQ1, glBreakdown, topTrend, rawTxns, bkfstQ1, covers, glRevSplitResp, glCostSplitResp, bkfstQ1Resp, captureOp, coversOp] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getDeptPl('fnb', 16).catch(() => []),
    getFnbCostsForPeriod(Q1_FROM, Q1_TO).catch(() => null),
    getFnbCaptureForPeriod(period.from, period.to).catch(() => null),
    getCanteenForPeriod(Q1_FROM, Q1_TO).catch(() => null),
    getFnbGlBreakdown(16).catch(() => ({ periods: [], lines: [] })),
    getFnbTopSellerTrend('2026-01-01', 8).catch(() => ({ periods: [], items: [] })),
    getFnbRawTransactions(2000).catch(() => []),
    getBreakfastAllocation(Q1_FROM, Q1_TO).catch(() => null),
    getFnbCovers(period.from, period.to).catch(() => null),
    // PBS 2026-06-09 #140 — live Food/Beverage revenue split from QB GL.
    // (the previous a30.fnb_food_revenue / fnb_beverage_revenue columns dont exist).
    supabase.schema('gl').from('mv_usali_pl_monthly')
      .select('usali_line_label, amount_usd')
      .ilike('usali_department', 'f%b')
      .eq('usali_subcategory', 'Revenue')
      .in('period_yyyymm', ['2026-01','2026-02','2026-03'])
      .then((r) => r),
    supabase.schema('gl').from('mv_usali_pl_monthly')
      .select('usali_subcategory, usali_line_label, account_name, amount_usd')
      .ilike('usali_department', 'f%b')
      .in('usali_subcategory', ['Cost of Sales','Payroll & Related'])
      .in('period_yyyymm', ['2026-01','2026-02','2026-03'])
      .then((r) => r),
    supabase.from('v_breakfast_allocation_q1_2026')
      .select('room_nights, adult_nights, child_nights, alloc_usd')
      .eq('property_id', 260955)
      .then((r) => r),
    // PBS #143 — op-scoped capture + covers for the Row 1 drilldown
    getFnbCaptureForPeriod(opFromIso, opEndIso).catch(() => null),
    getFnbCovers(opFromIso, opEndIso).catch(() => null),
  ]);
  // GL revenue is a credit → negative. Flip the sign for display.
  const glLines = ((glRevSplitResp?.data ?? []) as GlLineRow[]);
  const foodRevQ1 = -1 * glLines.filter((r) => /food/i.test(r.usali_line_label)).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const bevRevQ1  = -1 * glLines.filter((r) => /beverage|drink|bar/i.test(r.usali_line_label)).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  // PBS 2026-06-09 #140 — Cost split Q1 (Food + Beverage + Total Labour). Canteen accounts (EMPLOYEE MEAL / STAFF CANTEEN MATERIALS) explicitly excluded.
  type GlCostRow = { usali_subcategory: string; usali_line_label: string | null; account_name: string | null; amount_usd: number | string | null };
  const costLines = ((glCostSplitResp?.data ?? []) as GlCostRow[]);
  const isCanteenAcct = (a: string | null) => !!a && /(employee\s*meal|staff\s*canteen)/i.test(a);
  const foodCostQ1 = costLines.filter((r) => r.usali_subcategory === 'Cost of Sales' && /^food cost$/i.test(r.usali_line_label ?? '') && !isCanteenAcct(r.account_name)).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const bevCostQ1 = costLines.filter((r) => r.usali_subcategory === 'Cost of Sales' && /^beverage cost$/i.test(r.usali_line_label ?? '') && !isCanteenAcct(r.account_name)).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const labourQ1Gross = costLines.filter((r) => r.usali_subcategory === 'Payroll & Related').reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const labourCanteenPortion = costLines.filter((r) => r.usali_subcategory === 'Payroll & Related' && isCanteenAcct(r.account_name)).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const labourQ1 = labourQ1Gross - labourCanteenPortion;

  // PBS 2026-06-09 #140 — correct breakfast allocation (was $1,940 due to 1000-row cap on reservations).
  type BfastRow = { room_nights: number; adult_nights: number; child_nights: number; alloc_usd: number | string };
  const bfastRows = ((bkfstQ1Resp?.data ?? []) as BfastRow[]);
  const bfastAdultNights = bfastRows.reduce((s, r) => s + Number(r.adult_nights ?? 0), 0);
  const bfastChildNights = bfastRows.reduce((s, r) => s + Number(r.child_nights ?? 0), 0);
  const bfastAllocUsd    = bfastRows.reduce((s, r) => s + Number(r.alloc_usd ?? 0), 0);

  const canteen = canteenQ1;
  const bkfst = bfastAllocUsd > 0 ? { ...((bkfstQ1 ?? {}) as Record<string, unknown>), total_alloc_usd: bfastAllocUsd, adult_nights: bfastAdultNights, child_nights: bfastChildNights } : bkfstQ1;
  void daily;
  void covers;
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

  // Row 1 — Operating snapshot. Each tile labels its OWN period in the footnote
  // (PMS-driven tiles run on the rolling search-params window; GL-driven tiles
  // are pinned to Q1 2026, the last fully-mapped QB quarter).
  void a30;
  // PBS 2026-06-09 #143 — Row 1 reads op-scoped captureOp + coversOp instead of
  // the global resolvePeriod window so the drilldown pills (?op_period=) drive it.
  const row1: KpiTileProps[] = [
    { label: 'F&B Revenue (PMS)', value: fmtUsd(Number(coversOp?.revenue ?? 0)),
      footnote: coversOp ? `PMS POS · ${coversOp.covers} covers · ${opLabel}` : `PMS POS · ${opLabel} · no data`,
      status: (coversOp?.revenue ?? 0) > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'F&B Covers',  value: coversOp ? String(coversOp.covers) : '—',
      footnote: coversOp ? `${coversOp.days_active} active days · ${opLabel}` : `${opLabel} · no data`,
      status: (coversOp?.covers ?? 0) > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg check',   value: coversOp ? fmtUsd(coversOp.avg_check_usd) : '—',
      footnote: `PMS POS · ${opLabel}`,
      status: (coversOp?.avg_check_usd ?? 0) > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'F&B / Occ Rn', value: captureOp ? fmtUsd(Number(captureOp.spend_per_occ)) : '—',
      footnote: `PMS · spend per occupied room · ${captureOp ? opLabel : 'no capture rows'}`,
      status: captureOp ? 'green' : 'grey', size: 'sm' },
    { label: 'Capture %',    value: captureOp ? fmtPct(Number(captureOp.capture_pct)) : '—',
      footnote: captureOp ? `PMS · ${captureOp.res_with_purchase}/${captureOp.res_in_house} res · ${opLabel}` : `PMS · ${opLabel} · no data`,
      status: 'grey', size: 'sm' },
  ];


  // PBS 2026-06-09 #141 — Row 2 = USALI Effective view, Q1 2026 only.
  // ALL revenue + cost tiles live here so the Effective F&B Rev derivation is auditable.
  const row2: KpiTileProps[] = [
    // — Revenue side —
    { label: 'F&B Rev (excl breakfast)', value: fmtUsd(foodRevQ1 + bevRevQ1),
      footnote: `Q1 2026 · Food $${Math.round(foodRevQ1).toLocaleString('en-US')} + Beverage $${Math.round(bevRevQ1).toLocaleString('en-US')} · QB GL`,
      status: 'grey', size: 'sm' },
    { label: 'Breakfast alloc', value: fmtUsd(Number(bkfst?.total_alloc_usd ?? 0)),
      footnote: `Q1 2026 · ${bfastAdultNights.toLocaleString('en-US')} adult-nights × $10 + ${bfastChildNights.toLocaleString('en-US')} child-nights × $5`,
      status: 'grey', size: 'sm' },
    { label: 'Effective F&B Rev', value: fmtUsd(effectiveFnbRev),
      footnote: `GL rev + breakfast · Q1 2026 · $${Math.round(foodRevQ1+bevRevQ1).toLocaleString('en-US')} + $${Math.round(Number(bkfst?.total_alloc_usd ?? 0)).toLocaleString('en-US')}`,
      status: 'green', size: 'sm' },
    // — Cost side —
    { label: 'Food Cost', value: fmtUsd(foodCostQ1),
      footnote: 'Q1 2026 · Cost of Sales · canteen excluded · QB GL',
      status: foodCostQ1 > 0 ? 'amber' : 'grey', size: 'sm' },
    { label: 'Beverage Cost', value: fmtUsd(bevCostQ1),
      footnote: 'Q1 2026 · Cost of Sales · canteen excluded · QB GL',
      status: bevCostQ1 > 0 ? 'amber' : 'grey', size: 'sm' },
    { label: 'Total Labour', value: fmtUsd(labourQ1),
      footnote: `Q1 2026 · Wages & Benefits + Other Staff Cost · EMPLOYEE MEAL excluded ($${Math.round(labourCanteenPortion).toLocaleString('en-US')})`,
      status: labourQ1 > 0 ? 'amber' : 'grey', size: 'sm' },
    { label: 'Staff Canteen', value: fmtUsd(Number(canteen?.total_usd ?? 0)),
      footnote: 'Q1 2026 · EMPLOYEE MEAL + STAFF CANTEEN MATERIALS · QB GL',
      status: 'grey', size: 'sm' },
    { label: 'Canteen / Occ', value: fmtUsd(Number(canteen?.cost_per_occ_room ?? 0)),
      footnote: 'Q1 2026 · per occupied room-night · QB GL',
      status: 'grey', size: 'sm' },
    // — Margin ratios (USALI targets) —
    { label: 'Effective GOP $', value: fmtUsd(Number(effectiveGopUsd ?? 0)),
      footnote: 'Effective rev − total cost · Q1 2026',
      status: (effectiveGopUsd != null && effectiveGopUsd > 0 ? 'green' : 'red') as 'green'|'red', size: 'sm' },
    { label: 'Effective GOP %', value: fmtPct(Number(effectiveGopPct ?? 0)),
      footnote: 'target ≥ 25% · Q1 2026',
      status: (effectiveGopPct != null && effectiveGopPct >= 25 ? 'green' : 'amber') as 'green'|'amber', size: 'sm' },
    { label: 'Eff Labor %', value: fmtPct(Number(effectiveLaborPct ?? 0)),
      footnote: 'payroll ÷ effective rev · target ≤ 35% · Q1 2026',
      status: 'grey', size: 'sm' },
    { label: 'Eff Food %', value: fmtPct(effectiveFnbRev > 0 && tileSrc ? (tileSrc.food_cost / effectiveFnbRev) * 100 : 0),
      footnote: 'food cost ÷ effective rev · target ≤ 30% · Q1 2026',
      status: 'grey', size: 'sm' },
  ];


  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/restaurant') })) as DashboardTab[];

  const summaryStyle: React.CSSProperties = {
    cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600,
    color: '#000', background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 6, letterSpacing: '0.04em',
  };

  // PBS #143 — period-drilldown pills (server-rendered <a> links, RSC-safe)
  const opPills = (
    <div style={{ display: 'flex', gap: 4 }}>
      {OP_PERIODS.map((p) => {
        const label = p === 'yesterday' ? 'Yesterday' : p === '7d' ? 'Last 7d' : p === '30d' ? 'Last 30d' : 'YTD';
        const active = p === opPeriod;
        return (
          <a key={p} href={`/operations/restaurant?op_period=${p}`} style={{
            padding: '3px 8px', fontSize: 11, borderRadius: 4,
            border: active ? '1px solid #000' : '1px solid #E0E0E0',
            background: active ? '#000' : '#FFFFFF', color: active ? '#FFFFFF' : '#000',
            textDecoration: 'none', fontWeight: active ? 600 : 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>{label}</a>
        );
      })}
    </div>
  );

  return (
    <DashboardPage
      title={`Roots restaurant · ${period.label}`}
      subtitle="Operations · F&B · live from QB GL + PMS · USALI rollup"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Container title="Operating snapshot" subtitle={`PMS / Cloudbeds POS · revenue + capture · ${opLabel}`} density="compact" action={opPills}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row1.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title={`USALI Effective view · ${Q1_LABEL}`} subtitle="net of breakfast fair-value reclass — what the GL would say if the JE were posted. Scoped to Q1 2026 because QB GL F&B rows are empty after April (reclass to Undistributed)." density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row2.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <FilterStrip showForward={false} showCompare={false} showSegment={false} liveSource="PMS · live" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          <Container title="Staff canteen" subtitle={period.label}>
            <div style={{ fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic', fontSize: 22, lineHeight: 1.15, color: '#000', marginBottom: 6 }}>
              {canteen ? `$${Math.round(canteen.total_usd).toLocaleString()}` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.4 }}>
              <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>EMPLOYEE MEAL</code> + <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>STAFF CANTEEN MATERIALS</code> across all depts.
            </div>
            {canteen && canteen.by_dept.length > 0 && (
              <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 6 }}>
                By dept: {canteen.by_dept.map(d => `${d.dept} $${Math.round(d.usd).toLocaleString()}`).join(' · ')}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#B22222', background: 'rgba(178,34,34,0.08)', padding: '6px 8px', borderLeft: '2px solid #B22222', marginTop: 8 }}>
              <strong>Watch:</strong> Mar / Apr 2026 reclassified F&amp;B → Undistributed. The &quot;labor drop&quot; is a posting reclass, not a real saving.
            </div>
          </Container>

          <Container title="Breakfast allocation · USALI" subtitle="rooms → f&b">
            <div style={{ fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic', fontSize: 22, lineHeight: 1.15, color: '#000', marginBottom: 6 }}>
              {bkfst ? `$${Math.round(bkfst.total_alloc_usd).toLocaleString()}` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.4 }}>
              {bkfst ? <>{bkfst.adult_nights} adult-nights × $10 + {bkfst.child_nights} child-nights × $5 (fair value).</> : 'Pax-nights × $10/adult + $5/child.'}
              {' '}Configurable via <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>BREAKFAST_USD_ADULT</code>.
            </div>
            {effectiveLaborPct != null && tileSrc && (
              <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 6 }}>
                Labor% drops {tileSrc.labor_cost_pct.toFixed(1)}% → {effectiveLaborPct.toFixed(1)}% if JE applied.
              </div>
            )}
            <div style={{ fontSize: 11, color: '#1F7A4B', background: 'rgba(31,122,75,0.10)', padding: '6px 8px', borderLeft: '2px solid #1F7A4B', marginTop: 8 }}>
              <strong>Action:</strong> Monthly QB JE — <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>DR Rooms Rev · CR Food Rev</code>. Zero P&amp;L impact, USALI-clean.
            </div>
          </Container>

          <Container title="Menu engineering" subtitle="coming soon">
            <div style={{ fontFamily: 'ui-serif, Georgia, serif', fontStyle: 'italic', fontSize: 18, lineHeight: 1.15, color: '#5A5A5A', marginBottom: 6 }}>Stars · Plowhorses · Puzzles · Dogs</div>
            <div style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.4 }}>
              Each dish on popularity × profitability. Needs POS qty + recipe sheets in <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>inv.recipes</code>.
            </div>
          </Container>
        </div>

        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="last 16 months — live from gl.v_dept_pl_namkhan">
          <DeptTrendChart rows={pl} dept="fnb" />
        </Container>

        <Container title="P&L · QB GL · USALI rollup" subtitle="targets: food ≤30% · bev ≤25% · labor ≤35% · GOP ≥25%">
          <PnlGrid rows={pl} dept="fnb" targets={{ food_cost_pct: 30, bev_cost_pct: 25, labor_cost_pct: 35, gop_pct: 25 }} defaultRows={6} />
        </Container>

        <details>
          <summary style={summaryStyle}>GL detail · F&amp;B accounts (every QB line)</summary>
          <div style={{ marginTop: 10 }}>
            <FnbGlBreakdown data={glBreakdown} defaultMonths={4} />
          </div>
        </details>

        <details open>
          <summary style={summaryStyle}>Top sellers · trend since Jan 26</summary>
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
