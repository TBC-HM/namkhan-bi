// app/operations/restaurant/page.tsx
// PBS 2026-06-08 #136 — B&W primitives reskin. Legacy Page+KpiStrip+Panel swept
// to DashboardPage+Container+KpiTile. Layout, data sources, and collapsible
// sections preserved 1:1. All numbers still live from /lib/data fetchers.

import { DashboardPage, Container, KpiTile, type KpiTileProps, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import PnlGrid from '@/components/pl/PnlGrid';
import DeptTrendChart from '@/components/pl/DeptTrendChart';
import FnbGlBreakdown from '@/components/pl/FnbGlBreakdown';
import FnbTopSellerTrend from '@/components/pl/FnbTopSellerTrend';
import FnbRawTransactions from '@/components/pl/FnbRawTransactions';
import { FbCaptureChart, FbAvgTicketChart, FbCategoryChart } from '@/components/pl/FbMiniCharts';
import {
  getKpiDaily, aggregateDaily, getDeptPl, getFnbCovers,
  getFnbCostsForPeriod, getFnbCaptureForPeriod, getCanteenForPeriod,
  getFnbGlBreakdown, getFnbTopSellerTrend, getBreakfastAllocation, getFnbRawTransactions,
  getFnbRevenueByCategoryForPeriod,
} from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { supabase } from '@/lib/supabase';

interface GlLineRow { usali_line_label: string; amount_usd: number | string | null }

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; propertyId?: number; }

const fmtUsd = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

export default async function FnbPage({ searchParams, propertyId }: Props) {
  const pid = propertyId ?? 260955;
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
  const [daily, pl, periodCosts, captureP, canteenQ1, glBreakdown, topTrend, rawTxns, bkfstQ1, covers, glRevSplitResp, glCostSplitResp, bkfstQ1Resp, captureOp, coversOp, folioRowsResp, folioLatestResp, bkfstMonthlyResp, fnbCosMonthlyResp, fbCaptureResp, fbAvgTicketResp, fbCategoryResp, fbCatByPeriod, reconResp] = await Promise.all([
    getKpiDaily(period.from, period.to).catch(() => []),
    getDeptPl('fnb', 18).catch(() => []),  // PBS #161 — extend to Jan 2025 onwards (was 12, missed 2025 H1 disaster)
    getFnbCostsForPeriod(Q1_FROM, Q1_TO).catch(() => null),
    getFnbCaptureForPeriod(period.from, period.to).catch(() => null),
    getCanteenForPeriod(Q1_FROM, Q1_TO).catch(() => null),
    getFnbGlBreakdown(18).catch(() => ({ periods: [], lines: [] })),
    getFnbTopSellerTrend('2026-01-01', 2000).catch(() => ({ periods: [], items: [] })),
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
      .eq('property_id', pid)
      .then((r) => r),
    // PBS #143 — op-scoped capture + covers for the Row 1 drilldown
    getFnbCaptureForPeriod(opFromIso, opEndIso).catch(() => null),
    getFnbCovers(opFromIso, opEndIso).catch(() => null),
    // PBS #145 — Cloudbeds folio source for live F&B revenue. POS is for reconciliation only.
    supabase.from('v_fb_outlet_daily')
      .select('service_date, revenue, reservations')
      .eq('property_id', pid)
      .gte('service_date', opFromIso).lte('service_date', opEndIso)
      .then((r) => r),
    supabase.from('v_fb_outlet_daily')
      .select('service_date').eq('property_id', pid)
      .order('service_date', { ascending: false }).limit(1).maybeSingle()
      .then((r) => r),
    // PBS 2026-06-09 #150/#156 — monthly breakfast alloc for trailing 12 HISTORICAL months.
    // Reservations span into 2027 (pre-booked), so without an upper bound the LIMIT 12 grabs future
    // months and the breakfast map ends up with zero overlap on the chart's rows array.
    supabase.from('v_breakfast_allocation_monthly')
      .select('period_yyyymm, alloc_usd')
      .eq('property_id', pid)
      .lte('period_yyyymm', opToIso.slice(0, 7))
      .order('period_yyyymm', { ascending: false }).limit(12)
      .then((r) => r),
    // PBS 2026-06-09 #152 — monthly F&B Cost of Sales Jan-Dec for the cost strip
    supabase.from('v_fnb_cos_monthly')
      .select('period_yyyymm, food_cost, bev_cost, total_cost, cost_pct_of_eff_rev, food_cost_pct, bev_cost_pct, food_rev, breakfast_alloc')
      .gte('period_yyyymm', '2026-01').lte('period_yyyymm', '2026-12')
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    // PBS #159 — three mini-charts data (capture, avg ticket, category breakdown), since Jan 2025.
    supabase.from('v_fb_capture_monthly')
      .select('period_yyyymm, res_in_house, res_with_purchase, capture_pct, sold_room_nights, fb_cover_days, capture_per_rn_pct')
      .gte('period_yyyymm', '2025-01').lte('period_yyyymm', opToIso.slice(0, 7))
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.from('v_fb_avg_ticket_monthly')
      .select('period_yyyymm, revenue, reservations, avg_check')
      .gte('period_yyyymm', '2025-01').lte('period_yyyymm', opToIso.slice(0, 7))
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
    supabase.from('v_fb_category_monthly')
      .select('period_yyyymm, category, revenue')
      .gte('period_yyyymm', (() => { const d = new Date(opToday); d.setUTCMonth(d.getUTCMonth() - 11); return d.toISOString().slice(0, 7); })())
      .lte('period_yyyymm', opToIso.slice(0, 7))
      .then((r) => r),
    getFnbRevenueByCategoryForPeriod(opFromIso, opEndIso).catch(() => [] as Array<{ category: string; revenue_usd: number; tx_count: number; share_pct: number }>),
    // PBS 2026-06-10 #207 — Cloudbeds folio ↔ QB GL reconciliation (live gold view).
    supabase.from('v_fnb_folio_vs_gl_monthly')
      .select('period_yyyymm, folio_total, gl_total, delta_total_usd, folio_pct_of_gl, folio_food_rev, folio_bev_rev, folio_minibar_rev, gl_food_rev, gl_bev_rev')
      .order('period_yyyymm', { ascending: true })
      .then((r) => r),
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

  // PBS 2026-06-09 #145 — Cloudbeds folio F&B revenue (op-scoped).
  type FolioRow = { service_date: string; revenue: number | string; reservations: number };
  const folioRows = ((folioRowsResp?.data ?? []) as FolioRow[]);
  const folioRev = folioRows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const folioRes = folioRows.reduce((s, r) => s + Number(r.reservations ?? 0), 0);
  const folioActiveDays = new Set(folioRows.map((r) => String(r.service_date).slice(0,10))).size;
  const folioAvgCheck = folioRes > 0 ? folioRev / folioRes : 0;
  const folioLatestDate = (folioLatestResp?.data as { service_date?: string } | null)?.service_date ?? null;
  const folioIsStale = folioLatestDate ? (folioLatestDate < opEndIso) : true;

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
  // PBS 2026-06-09 #145 — Row 1 reads CLOUDBEDS FOLIO (live source of truth).
  // POS transactions live elsewhere for reconciliation only — they had 56%% null
  // reservation_ids that inflated covers, and the feed is also stale.
  const folioFresh = !folioIsStale;
  const staleFootnote = folioLatestDate
    ? `Cloudbeds folio last refreshed ${folioLatestDate}`
    : 'Cloudbeds folio · no data';
  const row1: KpiTileProps[] = [
    { label: 'F&B Revenue (Cloudbeds)', value: fmtUsd(folioRev),
      footnote: folioFresh ? `Cloudbeds folio · ${folioActiveDays} active days · ${opLabel}` : `${staleFootnote} · ${opLabel}`,
      status: folioFresh && folioRev > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Cover-days served', value: String(folioRes),
      footnote: folioFresh ? `Cloudbeds folio · res × days w/ F&B · ${opLabel}` : `${staleFootnote} · ${opLabel}`,
      status: folioFresh && folioRes > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'Avg check', value: folioRes > 0 ? fmtUsd(folioAvgCheck) : '—',
      footnote: folioFresh ? `Cloudbeds folio · revenue ÷ reservations · ${opLabel}` : `${staleFootnote} · ${opLabel}`,
      status: folioFresh && folioAvgCheck > 0 ? 'green' : 'grey', size: 'sm' },
    { label: 'F&B / Occ Rn', value: captureOp ? fmtUsd(Number(captureOp.spend_per_occ)) : '—',
      footnote: `Cloudbeds · spend per occupied room · ${captureOp ? opLabel : 'no capture rows'}`,
      status: captureOp ? 'green' : 'grey', size: 'sm' },
    { label: 'Capture %', value: captureOp ? fmtPct(Number(captureOp.capture_pct)) : '—',
      footnote: captureOp ? `Cloudbeds · ${captureOp.res_with_purchase}/${captureOp.res_in_house} res · ${opLabel}` : `Cloudbeds · ${opLabel} · no data`,
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
    // PBS 2026-06-09 #144 — canteen $ per day (Q1 = 90 days)
    { label: 'Canteen / day', value: fmtUsd(Number(canteen?.total_usd ?? 0) / 90),
      footnote: `Q1 2026 · canteen total ÷ 90 days (Jan-Mar) · QB GL`,
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
    // PBS 2026-06-09 #186 — Eff Food % now aligns with monthly cost strip below.
    // Both read from v_fnb_cos_monthly (canteen-excluded, room-night breakfast at $10/rn).
    // Previously divided by Q1 per-cover breakfast ($23,800 from adult×$10+child×$5) which
    // gave ~32.7% — disagreed with monthly tiles. Now uses room-night breakfast ($9,160 Q1)
    // matching the strip → ~48% as expected.
    { label: 'Eff Food %', value: fmtPct((() => {
        const q1 = ((fnbCosMonthlyResp?.data ?? []) as Array<{ period_yyyymm: string; food_cost: number | string | null; food_rev: number | string | null; breakfast_alloc: number | string | null }>)
          .filter((r) => ['2026-01','2026-02','2026-03'].includes(r.period_yyyymm));
        const fc = q1.reduce((s, r) => s + Number(r.food_cost ?? 0), 0);
        const fr = q1.reduce((s, r) => s + Number(r.food_rev ?? 0), 0);
        const bk = q1.reduce((s, r) => s + Number(r.breakfast_alloc ?? 0), 0);
        return (fr + bk) > 0 ? (fc / (fr + bk)) * 100 : 0;
      })()),
      footnote: 'food cost ÷ (food rev + breakfast) · v_fnb_cos_monthly · target ≤ 30% · Q1 2026',
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
          {fbCatByPeriod.length > 0 && (
            <>
              <div style={{ marginTop: 14, fontSize: 11, color: '#5A5A5A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Revenue by category · {opLabel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 6 }}>
                {fbCatByPeriod.map((c) => (
                  <KpiTile
                    key={c.category}
                    label={c.category}
                    value={`$${Math.round(c.revenue_usd).toLocaleString('en-US')}`}
                    footnote={`${c.share_pct.toFixed(1)}% of F&B · ${c.tx_count} tx`}
                    status="grey"
                    size="sm"
                  />
                ))}
              </div>
            </>
          )}
        </Container>

        {/* PBS #159 — three mini-charts under the head KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          <Container title="Capture %" subtitle="since Jan 2025 · folio purchases ÷ in-house res" density="compact">
            <FbCaptureChart rows={(fbCaptureResp?.data ?? []) as Array<{ period_yyyymm: string; capture_pct: number | string | null; res_in_house: number; res_with_purchase: number }>} />
          </Container>
          <Container title="Avg check" subtitle="since Jan 2025 · revenue ÷ reservations served" density="compact">
            <FbAvgTicketChart rows={(fbAvgTicketResp?.data ?? []) as Array<{ period_yyyymm: string; avg_check: number | string | null; revenue: number | string; reservations: number | string }>} />
          </Container>
          <Container title="Revenue by category" subtitle="last 12 months · top categories stacked" density="compact">
            <FbCategoryChart rows={(fbCategoryResp?.data ?? []) as Array<{ period_yyyymm: string; category: string; revenue: number | string }>} />
          </Container>
        </div>

        <Container title={`USALI Effective view · ${Q1_LABEL}`} subtitle="net of breakfast fair-value reclass — what the GL would say if the JE were posted. Scoped to Q1 2026 because QB GL F&B rows are empty after April (reclass to Undistributed)." density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {row2.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        {/* PBS 2026-06-10 #207 — Cloudbeds folio ↔ QB GL reconciliation */}
        <Container title="Cloudbeds folio ↔ QB GL · reconciliation" subtitle="folio = POS receipts (live) · GL = bookkeeper-posted (lags ~1 mo) · delta surfaces group billing not on folio OR mis-tagged QB lines">
          {(() => {
            type ReconRow = { period_yyyymm: string; folio_total: number | string; gl_total: number | string; delta_total_usd: number | string; folio_pct_of_gl: number | string | null; folio_food_rev: number | string; folio_bev_rev: number | string; folio_minibar_rev: number | string; gl_food_rev: number | string; gl_bev_rev: number | string };
            const rows = ((reconResp?.data ?? []) as ReconRow[]).filter((r) => Number(r.folio_total) > 0 || Number(r.gl_total) > 0);
            const q1 = rows.filter((r) => ['2026-01','2026-02','2026-03'].includes(r.period_yyyymm));
            const q1Folio = q1.reduce((s, r) => s + Number(r.folio_total ?? 0), 0);
            const q1Gl    = q1.reduce((s, r) => s + Number(r.gl_total ?? 0), 0);
            const q1Delta = q1Folio - q1Gl;
            const q1Pct   = q1Gl > 0 ? (q1Folio / q1Gl * 100) : 0;
            const tiles: KpiTileProps[] = [
              { label: 'Folio rev · Q1', value: fmtUsd(q1Folio), footnote: 'Cloudbeds POS receipts', status: 'grey', size: 'sm' },
              { label: 'QB GL rev · Q1', value: fmtUsd(q1Gl), footnote: 'bookkeeper-posted', status: 'grey', size: 'sm' },
              { label: 'Δ · Q1', value: `${q1Delta >= 0 ? '+' : ''}${fmtUsd(q1Delta)}`, footnote: q1Delta >= 0 ? 'folio over GL · unposted or group' : 'GL over folio · likely B2B billing',
                status: (Math.abs(q1Delta) / Math.max(q1Gl, 1) < 0.05 ? 'green' : Math.abs(q1Delta) / Math.max(q1Gl, 1) < 0.15 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
              { label: 'Folio % of GL · Q1', value: `${q1Pct.toFixed(1)}%`, footnote: 'target ~100%',
                status: (q1Pct >= 95 && q1Pct <= 110 ? 'green' : q1Pct >= 85 && q1Pct <= 120 ? 'amber' : 'red') as 'green'|'amber'|'red', size: 'sm' },
            ];
            const monthLabel = (yyyymm: string) => { const [y, m] = yyyymm.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }); };
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
                </div>
                <div style={{ marginTop: 14, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    <thead><tr style={{ borderBottom: '1px solid #000' }}>
                      <th style={{ textAlign: 'left', padding: 6 }}>Month</th>
                      <th style={{ textAlign: 'right', padding: 6 }}>Folio</th>
                      <th style={{ textAlign: 'right', padding: 6 }}>GL</th>
                      <th style={{ textAlign: 'right', padding: 6 }}>Δ</th>
                      <th style={{ textAlign: 'right', padding: 6 }}>Folio % GL</th>
                    </tr></thead>
                    <tbody>{rows.map((r) => {
                      const folio = Number(r.folio_total);
                      const gl = Number(r.gl_total);
                      const delta = Number(r.delta_total_usd);
                      const pct = r.folio_pct_of_gl == null ? null : Number(r.folio_pct_of_gl);
                      const flagColor = pct == null ? '#5A5A5A' : pct >= 95 && pct <= 110 ? '#1c4d3a' : Math.abs(delta) / Math.max(gl, 1) < 0.15 ? '#5A5A5A' : '#8e3a35';
                      return (
                        <tr key={r.period_yyyymm} style={{ borderBottom: '1px solid #F0F0F0' }}>
                          <td style={{ padding: 6, fontFamily: 'inherit' }}>{monthLabel(r.period_yyyymm)}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>{fmtUsd(folio)}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>{fmtUsd(gl)}</td>
                          <td style={{ padding: 6, textAlign: 'right', color: delta >= 0 ? '#1c4d3a' : '#8e3a35' }}>{delta >= 0 ? '+' : ''}{fmtUsd(delta)}</td>
                          <td style={{ padding: 6, textAlign: 'right', color: flagColor, fontWeight: 600 }}>{pct == null ? '—' : pct.toFixed(1) + '%'}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </Container>

        <Container title="Monthly trend · revenue · costs · GOP %" subtitle="Jan 2025 → current · live from gl.v_fnb_cos_monthly · breakfast bar = USALI fair-value reclass">
          <DeptTrendChart rows={pl} dept="fnb" breakfastByPeriod={Object.fromEntries(((bkfstMonthlyResp?.data ?? []) as Array<{ period_yyyymm: string; alloc_usd: number | string }>).map((r) => [r.period_yyyymm, Number(r.alloc_usd)]))} />
        </Container>

        {/* PBS #152 — monthly F&B Cost of Sales strip Jan-Dec (gold view v_fnb_cos_monthly, canteen-excluded, account-id based to catch the Jan QB class leak). Empty months = '—'. */}
        <Container title="F&B Cost of Sales · month-by-month" subtitle="2026 · Jan-Dec · canteen excluded · live from gl.v_fnb_cos_monthly · QB GL stops at April">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6 }}>
            {(() => {
              type CosRow = { period_yyyymm: string; food_cost: number | string | null; bev_cost: number | string | null; total_cost: number | string | null; cost_pct_of_eff_rev: number | string | null; food_cost_pct: number | string | null; bev_cost_pct: number | string | null };
              const rows = (fnbCosMonthlyResp?.data ?? []) as CosRow[];
              const byMonth: Record<number, CosRow | undefined> = {};
              for (const r of rows) {
                const m = Number((r.period_yyyymm ?? '').slice(5, 7));
                if (m >= 1 && m <= 12) byMonth[m] = r;
              }
              const monthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return monthAbbr.map((mon, idx) => {
                const m = idx + 1;
                const r = byMonth[m];
                const total = Number(r?.total_cost ?? 0);
                const food  = Number(r?.food_cost  ?? 0);
                const bev   = Number(r?.bev_cost   ?? 0);
                const pct   = r?.cost_pct_of_eff_rev != null ? Number(r.cost_pct_of_eff_rev) : null;
                const hasData = total > 0;
                void food; void bev;
                return (
                  <KpiTile key={mon} size="sm"
                    label={mon}
                    value={hasData ? `$${Math.round(total).toLocaleString('en-US')}` : '—'}
                    footnote={hasData && pct != null ? `${pct.toFixed(1)}% of revenue (incl breakfast)` : hasData ? 'cost only · no rev posted' : 'no QB GL'}
                    status={hasData ? 'grey' : 'grey'} />
                );
              });
            })()}
          </div>
        </Container>

        <Container title="P&L · QB GL · USALI rollup" subtitle="targets: food ≤30% · bev ≤25% · labor ≤35% · GOP ≥25%">
          <PnlGrid rows={pl} dept="fnb" targets={{ food_cost_pct: 30, bev_cost_pct: 25, labor_cost_pct: 35, gop_pct: 25 }} defaultRows={6} />
        </Container>

        <details>
          <summary style={summaryStyle}>GL detail · F&amp;B accounts (every QB line)</summary>
          <div style={{ marginTop: 10 }}>
            <FnbGlBreakdown data={glBreakdown} defaultMonths={3} />
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
