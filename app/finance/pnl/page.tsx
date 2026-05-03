// app/finance/pnl/page.tsx
// Finance · USALI P&L — full IA layout per proposal 2026-04-30.
// Branded skin (cream / forest-green / tan) sampled from /revenue/pulse.
// Wired tiles use Supabase data; unwired tiles render with "Data needed" badges
// referencing the schema gap (1–8) blocking them. See deploy-doc-schema-finance-pnl-2026-04-30.md.

import { getKpiDaily, aggregateDaily } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import {
  getPlSections, getUsaliHouse, getUsaliDept, getUsaliPlBySubcat,
  getDqUnmappedCount, getPendingDecisions, periodsForWindow, currentPeriod, pickSection, pickPeriod,
  getLyTotalRevenue, getLyByDept, getLyByUsaliDept, getDeptByPeriods,
  getBudgetByPeriod, getBudgetVsActual,
  getLyLinesByPeriod, getForecastLinesByPeriod,
  getDriversByPeriod, getFreshnessSummary, getMaterialityThreshold,
  getDqSummary, getPayrollByPeriod, getDemandSummary,
} from '../_data';
import { priorPeriod, type PeriodWindow } from '@/lib/supabase-gl';
import PageHeader from '@/components/layout/PageHeader';
import TwelveMonthPanel from './TwelveMonthPanel';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function fmtK(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const v = n / 1000;
  return `$${v.toFixed(dp)}k`;
}

function fmtPp(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(dp)} pp`;
}

function fmtPctV(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n.toFixed(dp)}%`;
}

export default async function PnLPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // Window selector (TODAY/7D/30D/90D/YTD) → period_yyyymm filter on gl.* tables.
  // Always pull a 12-month look-back so we can locate the latest CLOSED month
  // even when the calendar-current month has zero data (audit fix 2026-05-03).
  const win = ((searchParams.win as string) || '30D').toUpperCase() as PeriodWindow;
  const winPeriods = periodsForWindow(['TODAY','7D','30D','90D','YTD'].includes(win) ? win : '30D');
  const lookbackPeriods = (() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  })();
  const fetchPeriods = Array.from(new Set([...winPeriods, ...lookbackPeriods]));

  // Parallel fetch: gl.* + legacy daily KPI.
  // Subcategory queries use `fetchPeriods` (12-month lookback) so we always have
  // closed-month data even when the calendar-current month is empty.
  const [plSections, houseRows, deptRows, agSubcat, payrollSubcat, fbDeptOnly, otaCommissions, dqUnmapped, decisions, daily] = await Promise.all([
    getPlSections(fetchPeriods),
    getUsaliHouse(fetchPeriods),
    getUsaliDept(fetchPeriods),
    getUsaliPlBySubcat(fetchPeriods, 'A&G'),
    getUsaliPlBySubcat(fetchPeriods, 'Payroll & Related'),
    getUsaliDept(fetchPeriods).then(rs => rs.filter(r => r.usali_department === 'F&B')),
    getUsaliPlBySubcat(fetchPeriods, 'Sales & Marketing'),
    getDqUnmappedCount(),
    getPendingDecisions(5),
    getKpiDaily(period).catch(() => []),
  ]);

  // LY (last-year) data from gl.pnl_snapshot — used to populate the LY column
  // in the USALI grid + flow-through KPI. Only fetches once cur is known.
  const agg = aggregateDaily(daily, period.capacityMode);

  // Pick the latest CLOSED period: explicitly exclude the calendar-current month
  // (it's always in progress and may have stray $13 of misposted revenue) — and
  // require at least $1,000 of income to count as a "real" closed month.
  const calCur = currentPeriod();
  const periodsWithRev = Array.from(new Set(
    plSections
      .filter(r => r.section === 'income' && Number(r.amount_usd) >= 1000 && r.period_yyyymm !== calCur)
      .map(r => r.period_yyyymm)
  )).sort().reverse();
  const cur = periodsWithRev[0] || calCur;
  const prior = periodsWithRev[1] || priorPeriod(cur);
  const plPrior = plSections.filter(r => r.period_yyyymm === prior);

  // KPI calculations from gl.* — `cur` is the latest closed month with revenue
  const totalRev = pickSection(plSections.filter(r => r.period_yyyymm === cur), 'income');
  const priorTotalRev = pickSection(plPrior, 'income');
  const revVsPriorPct = priorTotalRev ? ((totalRev - priorTotalRev) / priorTotalRev) * 100 : 0;

  const houseCur = pickPeriod(houseRows, cur);
  const gop = houseCur?.gop ?? null;
  const gopMargin = (gop != null && totalRev > 0) ? (gop / totalRev) * 100 : null;
  const ebitda = (gop != null) ? gop - (houseCur?.depreciation || 0) - (houseCur?.interest || 0) - (houseCur?.income_tax || 0) : null;

  // Window stats: scope to the latest closed period only so the secondary KPIs
  // line up with the primary KPIs (both reflect April when calendar=May).
  const closedScope = [cur];
  const totalRevWindow = closedScope.reduce((s, p) => s + pickSection(plSections.filter(r => r.period_yyyymm === p), 'income'), 0);
  const totalPayrollWindow = payrollSubcat
    .filter(r => closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const labourPct = totalRevWindow > 0 ? (totalPayrollWindow / totalRevWindow) * 100 : null;

  const fbRevWindow = fbDeptOnly
    .filter(r => closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.revenue || 0), 0);
  const fbPayrollWindow = payrollSubcat
    .filter(r => r.usali_department === 'F&B' && closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const fbLabourPct = fbRevWindow > 0 ? (fbPayrollWindow / fbRevWindow) * 100 : null;

  const otaCommWindow = otaCommissions
    .filter(r => closedScope.includes(r.period_yyyymm))
    .filter(r => (r.usali_line_code || '').includes('OTA') || (r.account_id || '').startsWith('624'))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const channelsCommissionPct = totalRevWindow > 0 ? (otaCommWindow / totalRevWindow) * 100 : null;

  const agTotalWindow = agSubcat
    .filter(r => closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);

  // Dept rows for USALI table — current period only
  const deptCurMap = new Map(deptRows.filter(r => r.period_yyyymm === cur).map(r => [r.usali_department, r]));

  // LY fetch (parallel with rest is overkill — happens after we know `cur`)
  // Pull last 5 closed months for the heatmap + per-dept LY for the grid.
  const heatmapPeriods = (() => {
    const out: string[] = [];
    const [yy, mm] = cur.split('-').map(Number);
    for (let i = 0; i < 5; i++) {
      const d = new Date(yy, mm - 1 - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  })();
  // 12-month panel needs all of FY2026 actuals + budgets
  const fy2026 = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
  const [lyTotalRev, lyByDept, lyByUsaliDept, deptByPeriods, budgetCur, twelveMonth, lyLines, forecastLines, drivers, freshness, materiality, dqSummary, payrollMonth, demandFy] = await Promise.all([
    getLyTotalRevenue(cur),
    getLyByDept(cur),
    getLyByUsaliDept(cur),
    getDeptByPeriods(heatmapPeriods),
    getBudgetByPeriod(cur),
    getBudgetVsActual(fy2026),
    getLyLinesByPeriod(cur),       // Actuals 2025 same-month, keyed `${subcat}||${dept}`
    getForecastLinesByPeriod(cur), // Conservative 2026 cur-month
    getDriversByPeriod(cur),       // plan.drivers — room_nights/occ%/ADR for cur period
    getFreshnessSummary(),         // kpi.freshness_log rollup
    getMaterialityThreshold(),     // gl.materiality_thresholds (drives alert thresholds)
    getDqSummary(),                // dq.violations cross-pillar count
    getPayrollByPeriod(cur),       // ops.payroll_monthly for cur period (cross-check)
    getDemandSummary(fy2026),      // revenue.demand_calendar for FY2026
  ]);

  // Driver lookups: budget vs actuals from plan.drivers
  function pickDriver(scenario: string, key: string): number | null {
    const r = drivers.find(d => d.scenario_name === scenario && d.driver_key === key);
    return r ? Number(r.value_numeric) : null;
  }
  const budgetRoomNights = pickDriver('Budget 2026 v1', 'room_nights');
  const budgetOccPct     = pickDriver('Budget 2026 v1', 'occupancy_pct');
  const budgetAdr        = pickDriver('Budget 2026 v1', 'adr_usd');
  const ytdRoomNights    = pickDriver('Actuals 2026 YTD', 'room_nights');
  const ytdOccPct        = pickDriver('Actuals 2026 YTD', 'occupancy_pct');
  const ytdAdr           = pickDriver('Actuals 2026 YTD', 'adr_usd');
  // Materiality drives tactical alert breach thresholds (replaces hardcoded constants)
  const matPct  = materiality?.pct ?? 5;
  const matAbs  = materiality?.abs_usd ?? 1000;
  const lyRevBySubcat = new Map(lyByDept.map(r => [r.usali_subcategory, r.revenue]));
  const revVsLyPct = (lyTotalRev != null && lyTotalRev !== 0)
    ? ((totalRev - lyTotalRev) / lyTotalRev) * 100
    : null;
  const deptPriorMap = new Map(deptRows.filter(r => r.period_yyyymm === prior).map(r => [r.usali_department, r]));
  // Flow-through = ΔGOP / ΔRevenue. We have curGop but no LY GOP, so we
  // approximate flow as the year-over-year change in revenue retained as
  // current-period GOP — only meaningful when LY rev > 0 and gop is set.
  // True flow-through needs LY GOP — surfaced as `xx` when not available.

  const months = Array.from(new Set(plSections.map(r => r.period_yyyymm))).sort().reverse();
  const latestMonth = months[0] || cur;
  // Display label always reflects the latest CLOSED month (cur), not whatever
  // calendar-current month has stray $13. cur was already chosen with this
  // logic earlier; reuse it for every "this month" label on the page.
  const monthLabel = cur ? new Date(cur + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Apr 2026';
  const priorLabel = prior ? new Date(prior + '-01').toLocaleDateString('en-GB', { month: 'short' }) : '—';

  // === MoM variance per dept (replaces budget-variance waterfall) ============
  // For each dept: cur dept_profit − prior dept_profit. Top 6 by absolute
  // magnitude. Bar widths are scaled to the largest absolute value in the set.
  const deptOrderForVariance = ['Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated'];
  const variances = deptOrderForVariance
    .map(d => {
      const cur_ = deptCurMap.get(d);
      const prior_ = deptPriorMap.get(d);
      if (!cur_ && !prior_) return null;
      const curProfit = Number(cur_?.departmental_profit ?? 0);
      const priorProfit = Number(prior_?.departmental_profit ?? 0);
      const delta = curProfit - priorProfit;
      return { dept: d, delta, curProfit, priorProfit };
    })
    .filter(Boolean) as { dept: string; delta: number; curProfit: number; priorProfit: number }[];
  variances.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const maxAbsVar = Math.max(1, ...variances.map(v => Math.abs(v.delta)));

  // === Heatmap: dept × last-5-months departmental_profit (in $k) =============
  const heatmapPeriodsRev = [...heatmapPeriods].reverse(); // oldest → newest
  const heatmapDepts = ['Rooms', 'F&B', 'Spa', 'A&G' /* synthetic — only for label */];
  const dpByKey = new Map<string, number>();
  for (const r of deptByPeriods) dpByKey.set(`${r.period}|${r.dept}`, r.dept_profit);
  // A&G isn't a dept in v_usali_dept_summary — we'll use ag_total from houseRows instead.
  const houseByPeriod = new Map(houseRows.map(r => [r.period_yyyymm, r]));
  function heatmapCell(dept: string, period: string): { val: number | null; bg: string; color: string } {
    let v: number | null = null;
    if (dept === 'A&G') {
      const h = houseByPeriod.get(period);
      v = h && h.ag_total != null ? -Number(h.ag_total) : null; // shown as cost (negative impact on margin)
    } else {
      const k = `${period}|${dept}`;
      v = dpByKey.has(k) ? dpByKey.get(k)! : null;
    }
    if (v == null) return { val: null, bg: 'var(--surf-2, #f5f1e7)', color: 'inherit' };
    if (dept === 'A&G') {
      // A&G is overhead; bigger absolute = worse
      const abs = Math.abs(v) / 1000;
      if (abs >= 5) return { val: v, bg: 'var(--st-bad, #b34939)', color: 'var(--paper-warm, #f4ede0)' };
      if (abs >= 2) return { val: v, bg: 'var(--st-warn-bd, #d9a54e)', color: 'inherit' };
      return { val: v, bg: 'var(--st-good-bg, #d8e6cd)', color: 'inherit' };
    }
    // dept profit: positive = good, negative = bad
    if (v >= 0) return { val: v, bg: 'var(--st-good-bg, #d8e6cd)', color: 'inherit' };
    if (v >= -2000) return { val: v, bg: 'var(--st-warn-bd, #d9a54e)', color: 'inherit' };
    return { val: v, bg: 'var(--st-bad, #b34939)', color: 'var(--paper-warm, #f4ede0)' };
  }

  // === Tactical alerts: computed from real numbers ===========================
  // Each alert renders only if its threshold is breached. Otherwise hidden.
  type Alert = { sev: 'hi' | 'med' | 'low'; title: React.ReactNode; impact: string; dims: string; reason: string; tactic: string; handoff: string };
  const alerts: Alert[] = [];
  // 1. F&B cost % (cogs / revenue) — target ≤ 32%
  const fbCur = deptCurMap.get('F&B');
  if (fbCur) {
    const fbRev = Number(fbCur.revenue || 0);
    const fbCogs = Number(fbCur.cost_of_sales || 0);
    if (fbRev > 0) {
      const pct = (fbCogs / fbRev) * 100;
      if (pct > 32) {
        const impact = fbRev * (pct - 30) / 100;
        alerts.push({
          sev: pct > 40 ? 'hi' : 'med',
          title: <>F&amp;B cost % <strong>{pct.toFixed(1)}%</strong> (target 30%)</>,
          impact: `−$${(impact / 1000).toFixed(1)}k / mo`,
          dims: `dept=F&B × period=${monthLabel} · breach ${(pct - 30).toFixed(0)}pp`,
          reason: `Detector: cost_of_sales $${(fbCogs / 1000).toFixed(1)}k vs revenue $${(fbRev / 1000).toFixed(1)}k.`,
          tactic: 'Composer: 1) RFQ to alt suppliers 2) menu remix 3) renegotiate volume tier.',
          handoff: '→ Procurement Agent · approval req',
        });
      }
    }
  }
  // 2. Labour cost % overall — target ≤ 35%
  if (labourPct != null && labourPct > 35) {
    const impactPct = labourPct - 30;
    const impact = (totalRev * impactPct) / 100;
    alerts.push({
      sev: labourPct > 50 ? 'hi' : 'med',
      title: <>Labour cost <strong>{labourPct.toFixed(1)}%</strong> (target 30%)</>,
      impact: `−$${(impact / 1000).toFixed(1)}k / mo`,
      dims: `dept=All × period=${monthLabel} · breach ${impactPct.toFixed(0)}pp`,
      reason: `Detector: payroll $${(totalPayrollWindow / 1000).toFixed(1)}k vs revenue $${(totalRev / 1000).toFixed(1)}k.`,
      tactic: 'Composer: review roster vs occupancy; trim low-utilisation shifts.',
      handoff: '→ RosterAgent (Operations) · approval req',
    });
  }
  // 3. A&G $ MoM jump
  const agPrior = (() => {
    const arr = agSubcat.filter(r => r.period_yyyymm === prior);
    return arr.reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  })();
  if (agTotalWindow > 0 && agPrior > 0) {
    const delta = agTotalWindow - agPrior;
    const pct = (delta / agPrior) * 100;
    if (Math.abs(pct) > matPct * 3) {
      alerts.push({
        sev: Math.abs(pct) > 30 ? 'hi' : 'med',
        title: <>A&amp;G {pct >= 0 ? '+' : ''}{pct.toFixed(0)}% MoM (${(delta/1000).toFixed(1)}k)</>,
        impact: `${delta >= 0 ? '−' : '+'}$${Math.abs(delta / 1000).toFixed(1)}k / mo`,
        dims: `usali_subcategory=A&G × ${prior}→${cur}`,
        reason: `Detector: A&G $${(agTotalWindow / 1000).toFixed(1)}k this month vs $${(agPrior / 1000).toFixed(1)}k prior.`,
        tactic: 'Composer: drill into top accounts driving the change; reclassify if mis-coded.',
        handoff: '→ Controller Agent · review',
      });
    }
  }
  // 4. Utilities MoM (utilities subcat)
  const utilCur = Number(houseCur?.utilities ?? 0);
  const utilPrior = Number(pickPeriod(houseRows, prior)?.utilities ?? 0);
  if (utilCur > 0 && utilPrior > 0) {
    const delta = utilCur - utilPrior;
    const pct = (delta / utilPrior) * 100;
    if (Math.abs(pct) > matPct * 3) {
      alerts.push({
        sev: Math.abs(pct) > 30 ? 'med' : 'low',
        title: <>Utilities {pct >= 0 ? '+' : ''}{pct.toFixed(0)}% MoM</>,
        impact: `${delta >= 0 ? '−' : '+'}$${Math.abs(delta / 1000).toFixed(1)}k / mo`,
        dims: `usali_subcategory=Utilities × ${prior}→${cur}`,
        reason: `Detector: utilities $${(utilCur / 1000).toFixed(1)}k this month vs $${(utilPrior / 1000).toFixed(1)}k prior.`,
        tactic: 'Composer: dispatch maintenance check; review BMS schedule.',
        handoff: '→ Maintenance Agent · approval req',
      });
    }
  }

  // === Variance commentary template w/ real numbers ==========================
  const gopMomDelta = (() => {
    const priorH = pickPeriod(houseRows, prior);
    if (!priorH || priorH.gop == null || gop == null) return null;
    return gop - Number(priorH.gop);
  })();
  const gopMomPct = (() => {
    const priorH = pickPeriod(houseRows, prior);
    if (!priorH || priorH.gop == null || priorH.gop === 0 || gop == null) return null;
    return ((gop - Number(priorH.gop)) / Math.abs(Number(priorH.gop))) * 100;
  })();
  const topAg = agTotalWindow;
  const fbLabour = fbPayrollWindow;
  const fbBudget = fbRevWindow * 0.30; // proxy "budget" = 30% of revenue
  const fbOverPct = fbBudget > 0 ? ((fbLabour / fbBudget) - 1) * 100 : null;

  return (
    <div className="pnl-page">
      {/* ============== BLOCK 1 — Title + breadcrumb ============== */}
      <PageHeader
        pillar="Finance"
        tab="P&L"
        title={<>Profit &amp; loss · where the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>margin</em> lives.</>}
        lede="Where to act this week to defend GOP. USALI 11th ed."
      />

      {/* ============== BLOCK 2 — Period + write-policy banners ============== */}
      <div className="period-banner">
        <span>
          Active period: <b>{period.rangeLabel}</b> · {monthLabel} (MTD)
        </span>
        <span className="meta-token">
          win={period.win} · cmp={period.cmp} · ccy=usd · seg={period.seg}
        </span>
        {freshness && (
          <span className="meta-token" title={`${freshness.matview_count} matviews tracked · ${freshness.stale_count} stale · most-fresh ${Math.round(freshness.freshest_minutes)}m ago`}>
            data: {freshness.stale_count}/{freshness.matview_count} stale · last refresh {freshness.latest_refresh_at ? new Date(freshness.latest_refresh_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'}
          </span>
        )}
        {materiality && (
          <span className="meta-token" title="gl.materiality_thresholds — drives tactical alert thresholds + variance highlighting">
            materiality: {materiality.pct}% AND ${materiality.abs_usd}
          </span>
        )}
        {dqSummary && (
          <span className="meta-token" style={{ color: dqSummary.open_critical > 0 ? '#b34939' : (dqSummary.open_warning > 0 ? '#a17a4f' : 'inherit') }} title={`dq.violations: ${dqSummary.open_critical} critical · ${dqSummary.open_warning} warning · ${dqSummary.open_info} info`}>
            DQ: {dqSummary.open_total} open ({dqSummary.open_critical} crit · {dqSummary.open_warning} warn)
          </span>
        )}
      </div>

      {/* ============== BLOCK 2.5 — Driver strip (room nights / occ% / ADR) ============== */}
      {(budgetRoomNights != null || ytdRoomNights != null) && (
        <div className="kpi-section">
          <div className="kpi-row">
            <div className="kpi">
              <div className="scope">Volume</div>
              <div className="val">{budgetRoomNights != null ? budgetRoomNights.toFixed(0) : 'xx'}</div>
              <div className="deltas"><span className="neu">plan.drivers · room_nights</span></div>
              <div className="lbl">Budget room nights ({monthLabel})</div>
            </div>
            <div className="kpi">
              <div className="scope">Volume</div>
              <div className="val">{ytdRoomNights != null ? ytdRoomNights.toFixed(0) : 'xx'}</div>
              <div className="deltas">
                <span className={(ytdRoomNights != null && budgetRoomNights != null && ytdRoomNights >= budgetRoomNights) ? 'pos' : 'neg'}>
                  {(ytdRoomNights != null && budgetRoomNights != null) ? `${(((ytdRoomNights - budgetRoomNights) / budgetRoomNights) * 100).toFixed(1)}% vs budget` : '—'}
                </span>
              </div>
              <div className="lbl">Actual YTD room nights</div>
            </div>
            <div className="kpi">
              <div className="scope">Mix</div>
              <div className="val">{budgetOccPct != null ? `${budgetOccPct.toFixed(1)}%` : 'xx'}</div>
              <div className="deltas"><span className="neu">budget · occupancy_pct</span></div>
              <div className="lbl">Budget occupancy</div>
            </div>
            <div className="kpi">
              <div className="scope">Mix</div>
              <div className="val">{ytdOccPct != null ? `${ytdOccPct.toFixed(1)}%` : 'xx'}</div>
              <div className="deltas">
                <span className={(ytdOccPct != null && budgetOccPct != null && ytdOccPct >= budgetOccPct) ? 'pos' : 'neg'}>
                  {(ytdOccPct != null && budgetOccPct != null) ? `${(ytdOccPct - budgetOccPct).toFixed(1)} pp vs bgt` : '—'}
                </span>
              </div>
              <div className="lbl">Actual YTD occupancy</div>
            </div>
            <div className="kpi">
              <div className="scope">Rate</div>
              <div className="val">{budgetAdr != null ? `$${budgetAdr.toFixed(0)}` : 'xx'}</div>
              <div className="deltas"><span className="neu">budget · adr_usd</span></div>
              <div className="lbl">Budget ADR</div>
            </div>
            <div className="kpi">
              <div className="scope">Rate</div>
              <div className="val">{ytdAdr != null ? `$${ytdAdr.toFixed(0)}` : 'xx'}</div>
              <div className="deltas">
                <span className={(ytdAdr != null && budgetAdr != null && ytdAdr >= budgetAdr) ? 'pos' : 'neg'}>
                  {(ytdAdr != null && budgetAdr != null) ? `${(((ytdAdr - budgetAdr) / budgetAdr) * 100).toFixed(1)}% vs bgt` : '—'}
                </span>
              </div>
              <div className="lbl">Actual YTD ADR</div>
            </div>
          </div>
        </div>
      )}

      <div className="warn-banner">
        ⚠ <b>Cloudbeds write policy — pilot phase.</b>{' '}
        Agent-proposed reclassifications, JE proposals, and RFQs always require explicit human approval.
        Variance Composer never auto-publishes commentary. Controller Agent never posts to GL. Procurement
        Agent has no PO authority. After validation against 90 days of decisions, only Tier-1 actions
        (parity resync, &lt;$2k impact, ≥85% confidence) move to auto. Configure in <code>⚙ Agent Guardrails</code>.
      </div>

      {/* ============== BLOCK 4 — KPI grid (primary 6 + secondary 5) ============== */}
      <div className="kpi-section">
        {/* Primary 6 */}
        <div className="kpi-row">
          <div className="kpi">
            <div className="scope">Property</div>
            <div className="val">{fmtK(totalRev, 0)}</div>
            <div className="deltas">
              <span className={revVsPriorPct >= 0 ? 'pos' : 'neg'}>
                {revVsPriorPct >= 0 ? '▲' : '▼'} {fmtPctV(revVsPriorPct)} vs prior mo
              </span>
            </div>
            <div className="lbl">Total Revenue</div>
          </div>
          <div className={'kpi ' + (gop == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(gop)}</div>
            <div className="deltas"><span className="neu">{gop == null ? 'awaiting gl_entries load' : 'gl.v_usali_house_summary.gop'}</span></div>
            <div className="lbl">GOP $</div>
            {gop == null && <span className="needs" title="Run qb-deploy/gl_entries_load.sql">load gl_entries</span>}
          </div>
          <div className={'kpi ' + (gopMargin == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtPctV(gopMargin)}</div>
            <div className="deltas"><span className="neu">{gopMargin == null ? 'awaiting GOP$' : 'gop / total_revenue'}</span></div>
            <div className="lbl">GOP margin</div>
          </div>
          <div className={'kpi ' + (revVsLyPct == null ? 'dim' : '')}>
            <div className="scope">Flow</div>
            <div className="val">{revVsLyPct == null ? 'xx' : fmtPctV(revVsLyPct)}</div>
            <div className="deltas"><span className="neu">{revVsLyPct == null ? 'no LY data this month' : 'rev vs same month LY · pnl_snapshot'}</span></div>
            <div className="lbl">Revenue vs LY</div>
            {revVsLyPct == null && <span className="needs" title="gl.pnl_snapshot has no row for this period">no LY row</span>}
          </div>
          <div className={'kpi ' + (ebitda == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(ebitda)}</div>
            <div className="deltas"><span className="neu">{ebitda == null ? 'awaiting GOP$' : 'gop − depr − interest − tax'}</span></div>
            <div className="lbl">EBITDA</div>
          </div>
          <div className="kpi dim">
            <div className="scope">Cash</div>
            <div className="val">xx</div>
            <div className="deltas"><span className="neu">bank feed not connected</span></div>
            <div className="lbl">Cash on hand</div>
            <span className="needs" title="Gap 4 — gl.cash_forecast_weekly empty">not wired</span>
          </div>
        </div>

        {/* Secondary 5 */}
        <div className="kpi-row secondary">
          <div className={'kpi secondary ' + (labourPct == null ? 'dim' : '')}>
            <div className="scope">Ops</div>
            <div className="val">{fmtPctV(labourPct)}</div>
            <div className="deltas"><span className="neu">{labourPct == null ? 'awaiting gl_entries' : 'payroll ÷ revenue (window)'}</span></div>
            <div className="lbl">Labour cost %</div>
          </div>
          <div className={'kpi secondary ' + (fbLabourPct == null ? 'dim' : '')}>
            <div className="scope">F&amp;B</div>
            <div className="val">{fmtPctV(fbLabourPct)}</div>
            <div className="deltas"><span className="neu">{fbLabourPct == null ? 'awaiting gl_entries' : 'F&B payroll ÷ F&B revenue'}</span></div>
            <div className="lbl">F&amp;B labour %</div>
          </div>
          <div className={'kpi secondary ' + (channelsCommissionPct == null && (!agg || agg.commission_pct == null) ? 'dim' : '')}>
            <div className="scope">Channels</div>
            <div className="val">{channelsCommissionPct != null ? fmtPctV(channelsCommissionPct) : (agg && agg.commission_pct != null ? fmtPctV(agg.commission_pct as number) : '—')}</div>
            <div className="deltas"><span className="neu">{channelsCommissionPct != null ? 'gl.account_id LIKE 624%' : 'channels.commission_pct (legacy)'}</span></div>
            <div className="lbl">Distribution cost %</div>
          </div>
          <div className={'kpi secondary ' + (agTotalWindow === 0 ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(agTotalWindow)}</div>
            <div className="deltas"><span className="neu">{agTotalWindow === 0 ? 'awaiting gl_entries' : 'mv_usali_pl_monthly · A&G'}</span></div>
            <div className="lbl">A&amp;G $</div>
          </div>
          <div className="kpi secondary">
            <div className="scope">Audit</div>
            <div className="val">{dqUnmapped}</div>
            <div className="deltas"><span className="neu">DQ-04-UNMAPPED open</span></div>
            <div className="lbl">USALI mapping gaps</div>
          </div>
          {payrollMonth && (
            <div className="kpi secondary">
              <div className="scope">HR</div>
              <div className="val">{payrollMonth.staff_count}</div>
              <div className="deltas">
                <span className="neu">${(Number(payrollMonth.gross_payroll_usd) / 1000).toFixed(1)}k gross · {payrollMonth.total_days_worked} days</span>
              </div>
              <div className="lbl">Payroll · staff on roll</div>
            </div>
          )}
        </div>
      </div>

      {/* ============== BLOCK 5 — Agent strip ============== */}
      <div className="agent-strip">
        <span className="heading"><span className="dot" /> Finance agents <span className="new-badge" title="agents.runs not connected to runtime yet">configured · idle</span></span>
        <span className="chip" title="Trigger: daily 06:00 ICT. Output writes to governance.decision_queue."><span className="dot idle" />P&amp;L Detector</span>
        <span className="chip" title="Trigger: on-demand. Output writes to gl.commentary_drafts."><span className="dot idle" />Variance Composer</span>
        <span className="chip" title="Trigger: weekly Mon 07:00. Output writes JE proposals to governance.decision_queue."><span className="dot idle" />Controller Agent</span>
        <span className="chip" title="Trigger: weekly Wed 09:00. Output writes RFQ drafts to governance.decision_queue."><span className="dot idle" />Procurement Agent</span>
        <button type="button" className="fire" disabled>⚡ Fire all</button>
      </div>

      {/* ============== BLOCK 6 — Decision queue ============== */}
      <div className="section-head">
        <h3>Decisions <em>queued</em> for you</h3>
        <span className="meta">{decisions.length} pending · ranked by $ impact · source <code>governance.decision_queue</code></span>
      </div>
      {decisions.length === 0 ? (
        <div className="panel" style={{ padding: 16, textAlign: 'center', color: 'var(--ink-mute)' }}>
          ✓ No pending decisions. Items appear here when an agent (P&amp;L Detector / Variance Composer / Controller / Procurement) writes to <code>governance.decision_queue</code>.
        </div>
      ) : (
        <div className="queue">
          {decisions.map((d, i) => {
            const impact = d.impact_usd_estimate != null ? `+$${Math.round(Number(d.impact_usd_estimate)).toLocaleString()}` : '—';
            const title = String(d.title || (d as any).description || `Decision ${(d.id || '').toString().slice(0, 8)}`);
            const meta = `governance.decision_queue · ${(d as any).agent_code || ''} · status=${d.status || ''}`;
            return (
              <div className="qrow" key={i}>
                <div className="impact pos">{impact}</div>
                <div>
                  <div className="title">{title}</div>
                  <div className="meta-line">{meta}</div>
                </div>
                <div className="actions">
                  <button type="button" className="btn primary" disabled>Approve</button>
                  <button type="button" className="btn" disabled>Send back</button>
                  <button type="button" className="btn" disabled>Snooze</button>
                  <button type="button" className="btn" disabled>Open</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: "var(--t-sm)", color: 'var(--ink-mute, #8a8170)' }}>
        Action handlers (Approve/Snooze) require server actions wiring — defer to Phase 3.
      </div>

      {/* ============== BLOCK 7 — Tactical alerts ============== */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h3>Tactical <em>alerts</em></h3>
        <span className="meta">
          Computed from <code>v_usali_dept_summary</code> + <code>v_usali_house_summary</code> · period={cur}.
          Thresholds: F&amp;B cost &gt; 32% · Labour &gt; 35% · A&amp;G or Utilities MoM &gt; ±{(matPct * 3).toFixed(0)}% (3× materiality from <code>gl.materiality_thresholds</code>).
          {alerts.length === 0 ? ' All within bounds.' : ` ${alerts.length} breach${alerts.length > 1 ? 'es' : ''}.`}
        </span>
      </div>
      {alerts.length === 0 ? (
        <div className="panel" style={{ padding: 16, textAlign: 'center', color: 'var(--ink-mute)' }}>
          ✓ No tactical breaches this period — all monitored thresholds clean.
        </div>
      ) : (
        <div className="alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`alert ${a.sev}`}>
              <h4>{a.title} <span className="imp">{a.impact}</span></h4>
              <div className="dims">{a.dims}</div>
              <div className="reason">{a.reason}</div>
              <div className="tactic"><b>Composer:</b> {a.tactic}</div>
              <div className="handoffs">
                <button type="button" className="btn" disabled>{a.handoff}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============== BLOCK 8 — Core panels ============== */}
      <div className="panels" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginTop: 24 }}>
        {/* LEFT — USALI grid */}
        <div className="panel">
          <h3>USALI department <em>schedule</em> · {monthLabel} (MTD)</h3>
          <div className="meta">
            Materiality: 5% AND $1,000. Coloring — green ≤5% · amber 5–10% · red &gt;10% AND &gt;$1k.
            Expense rows tagged <b>Gap 2</b> until <code>gl.usali_expense_map</code> ships.
          </div>
          <table className="usali">
            <thead>
              <tr>
                <th>Line</th><th>Actual</th><th>Budget</th><th>LY</th><th>Δ Bgt</th><th>Δ%</th><th>Flow</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section"><td colSpan={7}>Revenue</td></tr>
              {(() => {
                const deptOrder = ['Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated'];
                const rows = deptOrder
                  .map((d) => {
                    const r = deptCurMap.get(d);
                    return { name: d, val: r ? Number(r.revenue || 0) : 0 };
                  })
                  .filter((r) => r.val > 0);
                if (rows.length === 0) {
                  return (
                    <tr><td colSpan={7} style={{ color: 'var(--muted, #8a8170)', fontStyle: 'italic', textAlign: 'center' }}>
                      No revenue rows for {cur} — awaiting <code>gl_entries</code> load (run <code>qb-deploy/gl_entries_load.sql</code>)
                    </td></tr>
                  );
                }
                return rows.map((r) => {
                  // LY now sourced from plan.lines · "Actuals 2025" — richer than pnl_snapshot
                  const lyRev = lyLines[`Revenue||${r.name}`] ?? null;
                  const priorR = deptPriorMap.get(r.name);
                  const priorRev = priorR ? Number(priorR.revenue || 0) : null;
                  const momPct = priorRev && priorRev !== 0 ? ((r.val - priorRev) / Math.abs(priorRev)) * 100 : null;
                  const budget = budgetCur[`Revenue||${r.name}`] ?? null;
                  const dBgt = budget != null ? r.val - budget : null;
                  const flowPct = budget != null && budget !== 0 ? ((r.val - budget) / Math.abs(budget)) * 100 : null;
                  return (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{fmtK(r.val)}</td>
                    <td title={budget != null ? `Budget 2026 v1 · Revenue · ${r.name}` : 'no budget row'}>{budget != null ? fmtK(budget) : <span>xx</span>}</td>
                    <td title={lyRev != null ? `Actuals 2025 · Revenue · ${r.name}` : 'no LY row'}>{lyRev != null && lyRev > 0 ? fmtK(lyRev) : <span>xx</span>}</td>
                    <td className={dBgt == null ? '' : (dBgt >= 0 ? 'var-green' : 'var-amber')}>{dBgt != null ? fmtK(dBgt) : <span title="no budget row">xx</span>}</td>
                    <td title={priorRev != null ? `${prior} dept rev: $${(priorRev/1000).toFixed(1)}k` : 'no prior-mo dept row'} className={momPct == null ? '' : (momPct >= 0 ? 'var-green' : 'var-amber')}>{momPct != null ? fmtPctV(momPct) : <span title="no prior-mo data">xx</span>}</td>
                    <td className={flowPct == null ? '' : (flowPct >= 0 ? 'var-green' : 'var-amber')} title="vs Budget %">{flowPct != null ? fmtPctV(flowPct) : <span title="no budget">xx</span>}</td>
                  </tr>
                  );
                });
              })()}
              {(() => {
                // Total revenue budget = sum of all Revenue||* rows for cur period
                const revBudget = Object.entries(budgetCur)
                  .filter(([k]) => k.startsWith('Revenue||'))
                  .reduce((s, [, v]) => s + Number(v || 0), 0);
                const dBgt = revBudget > 0 ? totalRev - revBudget : null;
                const flowPct = revBudget > 0 ? ((totalRev - revBudget) / Math.abs(revBudget)) * 100 : null;
                return (
                  <tr className="subtotal">
                    <td>Total Revenue</td>
                    <td>{fmtK(totalRev)}</td>
                    <td title={revBudget > 0 ? 'sum of all Revenue subcat rows' : 'no budget rows'}>{revBudget > 0 ? fmtK(revBudget) : <span>xx</span>}</td>
                    <td>{lyTotalRev != null ? fmtK(lyTotalRev) : <span title="no pnl_snapshot row for this period">xx</span>}</td>
                    <td className={dBgt == null ? '' : (dBgt >= 0 ? 'var-green' : 'var-amber')}>{dBgt != null ? fmtK(dBgt) : <span>xx</span>}</td>
                    <td className={revVsPriorPct >= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(revVsPriorPct)}</td>
                    <td className={flowPct == null ? '' : (flowPct >= 0 ? 'var-green' : 'var-amber')}>{flowPct != null ? fmtPctV(flowPct) : <span>xx</span>}</td>
                  </tr>
                );
              })()}

              <tr className="section"><td colSpan={7}>Departmental Expenses (USALI · live from <code>gl.v_usali_dept_summary</code>)</td></tr>
              {(() => {
                const deptOrder = ['Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated'];
                const rows = deptOrder
                  .map((d) => {
                    const r = deptCurMap.get(d);
                    if (!r) return null;
                    const exp = (Number(r.cost_of_sales || 0) + Number(r.payroll || 0) + Number(r.other_op_exp || 0));
                    if (exp <= 0) return null;
                    return { name: d, val: exp };
                  })
                  .filter(Boolean) as { name: string; val: number }[];
                if (rows.length === 0) {
                  return (
                    <tr><td colSpan={7} style={{ color: 'var(--muted, #8a8170)', fontStyle: 'italic', textAlign: 'center' }}>
                      No expense rows for {cur} — awaiting <code>gl_entries</code> load
                    </td></tr>
                  );
                }
                return rows.map((r) => {
                  // LY expense sum from Actuals 2025 — same 3 subcats per dept
                  const lyExp = (lyLines[`Cost of Sales||${r.name}`] ?? 0)
                    + (lyLines[`Payroll & Related||${r.name}`] ?? 0)
                    + (lyLines[`Other Operating Expenses||${r.name}`] ?? 0);
                  const hasLy = lyExp > 0;
                  const priorR = deptPriorMap.get(r.name);
                  const priorExp = priorR ? Number(priorR.cost_of_sales || 0) + Number(priorR.payroll || 0) + Number(priorR.other_op_exp || 0) : null;
                  const momPct = priorExp && priorExp !== 0 ? ((r.val - priorExp) / Math.abs(priorExp)) * 100 : null;
                  const expBudget = (budgetCur[`Cost of Sales||${r.name}`] ?? 0)
                    + (budgetCur[`Payroll & Related||${r.name}`] ?? 0)
                    + (budgetCur[`Other Operating Expenses||${r.name}`] ?? 0);
                  const hasBudget = expBudget > 0;
                  const dBgt = hasBudget ? r.val - expBudget : null;
                  const flowPct = hasBudget ? ((r.val - expBudget) / Math.abs(expBudget)) * 100 : null;
                  return (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{fmtK(r.val)}</td>
                    <td title={hasBudget ? `sum expense subcats for ${r.name}` : 'no expense budget rows'}>{hasBudget ? fmtK(expBudget) : <span>xx</span>}</td>
                    <td title={hasLy ? `Actuals 2025 · expenses · ${r.name}` : 'no LY row'}>{hasLy ? fmtK(lyExp) : <span>xx</span>}</td>
                    <td className={dBgt == null ? '' : (dBgt <= 0 ? 'var-green' : 'var-amber')}>{dBgt != null ? fmtK(dBgt) : <span>xx</span>}</td>
                    <td title={priorExp != null ? `${prior} dept expense: $${(priorExp/1000).toFixed(1)}k` : 'no prior-mo dept row'} className={momPct == null ? '' : (momPct <= 0 ? 'var-green' : 'var-amber')}>{momPct != null ? fmtPctV(momPct) : <span title="no prior-mo data">xx</span>}</td>
                    <td className={flowPct == null ? '' : (flowPct <= 0 ? 'var-green' : 'var-amber')} title="vs Budget %">{flowPct != null ? fmtPctV(flowPct) : <span>xx</span>}</td>
                  </tr>
                  );
                });
              })()}

              {(() => {
                const priorH = pickPeriod(houseRows, prior);
                function MomCell({ cur_, prior_, betterDown = false }: { cur_: number | null; prior_: number | null; betterDown?: boolean }) {
                  if (cur_ == null || prior_ == null || prior_ === 0) {
                    return <td><span title="no prior-mo data">xx</span></td>;
                  }
                  const pct = ((cur_ - prior_) / Math.abs(prior_)) * 100;
                  const cls = (betterDown ? pct <= 0 : pct >= 0) ? 'var-green' : 'var-amber';
                  return <td title={`prior ${prior}: $${(prior_/1000).toFixed(1)}k`} className={cls}>{fmtPctV(pct)}</td>;
                }
                // Undistributed budget + LY lookups (subcat||'' since dept is empty)
                function bg(subcat: string): number | null {
                  const v = budgetCur[`${subcat}||`];
                  return v != null && v !== 0 ? v : null;
                }
                function ly(subcat: string): number | null {
                  const v = lyLines[`${subcat}||`];
                  return v != null && v !== 0 ? v : null;
                }
                function BudgetCells({ actual, subcat, betterDown = false }: { actual: number | null; subcat: string; betterDown?: boolean }) {
                  const b = bg(subcat);
                  const lyAmt = ly(subcat);
                  const dBgt = (actual != null && b != null) ? actual - b : null;
                  return (<>
                    <td title={b != null ? `Budget 2026 v1 · ${subcat}` : 'no budget row'}>{b != null ? fmtK(b) : <span>xx</span>}</td>
                    <td title={lyAmt != null ? `Actuals 2025 · ${subcat}` : 'no LY row'}>{lyAmt != null ? fmtK(lyAmt) : <span>xx</span>}</td>
                    <td className={dBgt == null ? '' : ((betterDown ? dBgt <= 0 : dBgt >= 0) ? 'var-green' : 'var-amber')}>{dBgt != null ? fmtK(dBgt) : <span>xx</span>}</td>
                  </>);
                }
                const priorDeptProfit = priorH ? Number(priorH.total_dept_profit ?? 0) : null;
                const priorAg = priorH ? Number(priorH.ag_total ?? 0) : null;
                const priorSm = priorH ? Number(priorH.sales_marketing ?? 0) : null;
                const priorPom = priorH ? Number(priorH.pom ?? 0) : null;
                const priorUtil = priorH ? Number(priorH.utilities ?? 0) : null;
                const priorMgmt = priorH ? Number(priorH.mgmt_fees ?? 0) : null;
                const priorGop = priorH ? Number(priorH.gop ?? 0) : null;
                const priorEbitda = priorH != null ? Number(priorH.gop ?? 0) - Number(priorH.depreciation ?? 0) - Number(priorH.interest ?? 0) - Number(priorH.income_tax ?? 0) : null;

                // Composite Budget + LY for GOP / Dept Profit / EBITDA
                // Sum across all keys in budgetCur / lyLines
                function sumKeys(src: Record<string, number>, predicate: (subcat: string) => boolean): number {
                  let s = 0;
                  for (const [k, v] of Object.entries(src)) {
                    const subcat = k.split('||')[0];
                    if (predicate(subcat)) s += Number(v || 0);
                  }
                  return s;
                }
                const REV_SC = (sc: string) => sc === 'Revenue';
                const DEPT_EXP_SC = (sc: string) => ['Cost of Sales','Payroll & Related','Other Operating Expenses'].includes(sc);
                const UNDIST_SC = (sc: string) => ['A&G','Sales & Marketing','POM','Utilities','Mgmt Fees'].includes(sc);
                const BELOW_GOP_SC = (sc: string) => ['Depreciation','Interest','Income Tax','FX Gain/Loss','Non-Operating'].includes(sc);

                const budgetRev    = sumKeys(budgetCur, REV_SC);
                const budgetDeptExp = sumKeys(budgetCur, DEPT_EXP_SC);
                const budgetUndist = sumKeys(budgetCur, UNDIST_SC);
                const budgetBelowGop = sumKeys(budgetCur, BELOW_GOP_SC);
                const budgetDeptProfit = budgetRev - budgetDeptExp;
                const budgetGop = budgetDeptProfit - budgetUndist;
                const budgetEbitda = budgetGop - budgetBelowGop; // simple proxy

                const lyRev_    = sumKeys(lyLines, REV_SC);
                const lyDeptExp_ = sumKeys(lyLines, DEPT_EXP_SC);
                const lyUndist_ = sumKeys(lyLines, UNDIST_SC);
                const lyBelowGop_ = sumKeys(lyLines, BELOW_GOP_SC);
                const lyDeptProfit = lyRev_ - lyDeptExp_;
                const lyGop = lyDeptProfit - lyUndist_;
                const lyEbitda = lyGop - lyBelowGop_;

                function VarBgt({ a, b, betterDown = false }: { a: number | null; b: number; betterDown?: boolean }) {
                  if (a == null || b === 0) return <td><span>xx</span></td>;
                  const v = a - b;
                  const cls = (betterDown ? v <= 0 : v >= 0) ? 'var-green' : 'var-amber';
                  return <td className={cls}>{fmtK(v)}</td>;
                }
                function FlowPct({ a, b, betterDown = false }: { a: number | null; b: number; betterDown?: boolean }) {
                  if (a == null || b === 0) return <td><span>xx</span></td>;
                  const v = ((a - b) / Math.abs(b)) * 100;
                  const cls = (betterDown ? v <= 0 : v >= 0) ? 'var-green' : 'var-amber';
                  return <td className={cls}>{fmtPctV(v)}</td>;
                }
                return (
                  <>
                    <tr className="gop">
                      <td>Departmental Profit</td>
                      <td>{fmtK(houseCur?.total_dept_profit ?? null)}</td>
                      <td title="Budget rev minus dept expenses">{budgetDeptProfit !== 0 ? fmtK(budgetDeptProfit) : <span>xx</span>}</td>
                      <td title="LY rev minus dept expenses · Actuals 2025">{lyDeptProfit !== 0 ? fmtK(lyDeptProfit) : <span>xx</span>}</td>
                      <VarBgt a={houseCur?.total_dept_profit ?? null} b={budgetDeptProfit} />
                      <MomCell cur_={houseCur?.total_dept_profit ?? null} prior_={priorDeptProfit} />
                      <FlowPct a={houseCur?.total_dept_profit ?? null} b={budgetDeptProfit} />
                    </tr>

                    <tr className="section"><td colSpan={7}>Undistributed Operating Expenses (live from <code>gl.v_usali_house_summary</code>)</td></tr>
                    <tr>
                      <td>A&amp;G</td>
                      <td>{fmtK(houseCur?.ag_total ?? null)}</td>
                      <BudgetCells actual={houseCur?.ag_total ?? null} subcat="A&G" betterDown />
                      <MomCell cur_={houseCur?.ag_total ?? null} prior_={priorAg} betterDown />
                      <td title="vs Budget %">{(() => { const b = bg('A&G'); const a = houseCur?.ag_total ?? null; if (b == null || a == null || b === 0) return <span>xx</span>; const p = ((a - b) / Math.abs(b)) * 100; return <span className={p <= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(p)}</span>; })()}</td>
                    </tr>
                    <tr>
                      <td>Sales &amp; Marketing</td>
                      <td>{fmtK(houseCur?.sales_marketing ?? null)}</td>
                      <BudgetCells actual={houseCur?.sales_marketing ?? null} subcat="Sales & Marketing" betterDown />
                      <MomCell cur_={houseCur?.sales_marketing ?? null} prior_={priorSm} betterDown />
                      <td title="vs Budget %">{(() => { const b = bg('Sales & Marketing'); const a = houseCur?.sales_marketing ?? null; if (b == null || a == null || b === 0) return <span>xx</span>; const p = ((a - b) / Math.abs(b)) * 100; return <span className={p <= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(p)}</span>; })()}</td>
                    </tr>
                    <tr>
                      <td>POM</td>
                      <td>{fmtK(houseCur?.pom ?? null)}</td>
                      <BudgetCells actual={houseCur?.pom ?? null} subcat="POM" betterDown />
                      <MomCell cur_={houseCur?.pom ?? null} prior_={priorPom} betterDown />
                      <td title="vs Budget %">{(() => { const b = bg('POM'); const a = houseCur?.pom ?? null; if (b == null || a == null || b === 0) return <span>xx</span>; const p = ((a - b) / Math.abs(b)) * 100; return <span className={p <= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(p)}</span>; })()}</td>
                    </tr>
                    <tr>
                      <td>Utilities</td>
                      <td>{fmtK(houseCur?.utilities ?? null)}</td>
                      <BudgetCells actual={houseCur?.utilities ?? null} subcat="Utilities" betterDown />
                      <MomCell cur_={houseCur?.utilities ?? null} prior_={priorUtil} betterDown />
                      <td title="vs Budget %">{(() => { const b = bg('Utilities'); const a = houseCur?.utilities ?? null; if (b == null || a == null || b === 0) return <span>xx</span>; const p = ((a - b) / Math.abs(b)) * 100; return <span className={p <= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(p)}</span>; })()}</td>
                    </tr>
                    <tr>
                      <td>Mgmt Fees</td>
                      <td>{fmtK(houseCur?.mgmt_fees ?? null)}</td>
                      <BudgetCells actual={houseCur?.mgmt_fees ?? null} subcat="Mgmt Fees" betterDown />
                      <MomCell cur_={houseCur?.mgmt_fees ?? null} prior_={priorMgmt} betterDown />
                      <td title="vs Budget %">{(() => { const b = bg('Mgmt Fees'); const a = houseCur?.mgmt_fees ?? null; if (b == null || a == null || b === 0) return <span>xx</span>; const p = ((a - b) / Math.abs(b)) * 100; return <span className={p <= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(p)}</span>; })()}</td>
                    </tr>

                    <tr className="gop">
                      <td>GOP after Undistributed</td>
                      <td>{fmtK(houseCur?.gop ?? null)}</td>
                      <td title="Dept profit budget minus undistributed budget">{budgetGop !== 0 ? fmtK(budgetGop) : <span>xx</span>}</td>
                      <td title="LY · Actuals 2025 GOP composite">{lyGop !== 0 ? fmtK(lyGop) : <span>xx</span>}</td>
                      <VarBgt a={houseCur?.gop ?? null} b={budgetGop} />
                      <MomCell cur_={houseCur?.gop ?? null} prior_={priorGop} />
                      <FlowPct a={houseCur?.gop ?? null} b={budgetGop} />
                    </tr>

                    <tr className="ebitda">
                      <td>EBITDA</td>
                      <td>{fmtK(ebitda)}</td>
                      <td title="GOP budget minus depreciation/interest/tax/FX/non-op budget">{budgetEbitda !== 0 ? fmtK(budgetEbitda) : <span>xx</span>}</td>
                      <td title="LY · Actuals 2025 EBITDA composite">{lyEbitda !== 0 ? fmtK(lyEbitda) : <span>xx</span>}</td>
                      <VarBgt a={ebitda} b={budgetEbitda} />
                      <MomCell cur_={ebitda} prior_={priorEbitda} />
                      <FlowPct a={ebitda} b={budgetEbitda} />
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* RIGHT — sidekick stack */}
        <div>
          <div className="panel">
            <h3>Top <em>variances</em> · MoM dept profit</h3>
            <div className="meta">{cur} vs {prior} · departmental_profit per <code>v_usali_dept_summary</code>. Budget-variance switches on once <code>gl.budgets</code> ships.</div>
            <div className="waterfall">
              {variances.length === 0 ? (
                <div className="meta" style={{ padding: 8 }}>No dept rows for {cur} or {prior}.</div>
              ) : variances.map(v => {
                const pct = (Math.abs(v.delta) / maxAbsVar) * 100;
                const cls = v.delta >= 0 ? 'pos' : 'neg';
                const sign = v.delta >= 0 ? '+' : '−';
                return (
                  <div className="wfr" key={v.dept}>
                    <div className="lbl">{v.dept} dept profit</div>
                    <div><div className={`bar ${cls}`} style={{ width: `${pct.toFixed(0)}%` }} /></div>
                    <div className={`num ${cls}`}>{sign}${(Math.abs(v.delta)/1000).toFixed(1)}k</div>
                  </div>
                );
              })}
            </div>
            <div className="meta" style={{ marginTop: 8 }}>Sorted by absolute Δ. Switches to vs-Budget once <code>gl.budgets</code> populated.</div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>13-week <em>cash</em> forecast <span className="needs" style={{ marginLeft: 8 }}>not wired</span></h3>
            <div className="meta"><code>gl.cash_forecast_weekly</code> exists but has 0 rows — needs bank feed import.</div>
            <div className="cash-strip">
              <div className="flag">cash dip Wxx–Wxx</div>
              <div className="legend">$ position · weekly buckets · xx (placeholder)</div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>Margin leak <em>heatmap</em></h3>
            <div className="meta">$k departmental_profit · dept × month · last 5 closed months · {heatmapPeriodsRev[0]} → {cur}. Source: <code>v_usali_dept_summary</code> (A&amp;G from <code>v_usali_house_summary</code>).</div>
            <div className="heatmap">
              {heatmapDepts.map(dept => (
                <>
                  <div className="hm-lbl" key={`lbl-${dept}`}>{dept}</div>
                  {heatmapPeriodsRev.map(p => {
                    const c = heatmapCell(dept, p);
                    const display = c.val == null ? '—' : `${c.val < 0 ? '-' : ''}${(Math.abs(c.val)/1000).toFixed(1)}`;
                    return (
                      <div
                        key={`${dept}-${p}`}
                        className="hm"
                        title={`${dept} · ${p} · ${dept === 'A&G' ? 'A&G overhead' : 'departmental_profit'}: ${c.val == null ? 'no data' : '$' + c.val.toLocaleString()}`}
                        style={{ background: c.bg, color: c.color }}
                      >
                        {display}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>Variance <em>commentary</em> · auto-draft</h3>
            <div className="meta">Template-based · numbers from gl.* · LLM rewrite pending. Source: this period vs prior.</div>
            <div className="comm">
              <h4>Headline</h4>
              <p>
                {monthLabel} closes with revenue {totalRev > priorTotalRev ? 'up' : 'down'}{' '}
                <strong>{Math.abs(revVsPriorPct).toFixed(1)}%</strong> vs {priorLabel} (${(totalRev/1000).toFixed(1)}k vs ${(priorTotalRev/1000).toFixed(1)}k).{' '}
                {gop != null ? <>GOP $${(gop/1000).toFixed(1)}k {gopMomDelta != null && gopMomPct != null && (
                  <>({gopMomDelta >= 0 ? '+' : '−'}${Math.abs(gopMomDelta/1000).toFixed(1)}k MoM, {gopMomPct >= 0 ? '+' : ''}{gopMomPct.toFixed(0)}%)</>
                )}.</> : <>GOP awaiting expense load.</>}
                {' '}{revVsLyPct != null ? <>vs LY same month: <strong>{revVsLyPct >= 0 ? '+' : ''}{revVsLyPct.toFixed(1)}%</strong>.</> : <>No LY comparable yet.</>}
              </p>
              {topAg > 0 && (
                <>
                  <h4>A&amp;G</h4>
                  <p>
                    A&amp;G ran <strong>${(topAg/1000).toFixed(1)}k</strong> this month (
                    {agPrior > 0 ? <>{topAg > agPrior ? 'up' : 'down'} {Math.abs(((topAg - agPrior)/agPrior)*100).toFixed(0)}% vs ${(agPrior/1000).toFixed(1)}k prior</> : 'no prior comparable'}
                    ). Top accounts driving the line are visible in <a href="/finance/mapping">/finance/mapping</a>.
                  </p>
                </>
              )}
              {fbCur && Number(fbCur.revenue) > 0 && (
                <>
                  <h4>F&amp;B</h4>
                  <p>
                    F&amp;B labour <strong>${(fbLabour/1000).toFixed(1)}k</strong> vs revenue ${(fbRevWindow/1000).toFixed(1)}k → ratio{' '}
                    <strong>{fbLabourPct != null ? fbLabourPct.toFixed(1) : '—'}%</strong>{' '}
                    {fbLabourPct != null && (fbLabourPct > 35 ? '(above 28–32% norm — Margin Leak Sentinel: yes)' : '(within 28–32% norm)')}.
                    Cost of sales ${(Number(fbCur.cost_of_sales)/1000).toFixed(1)}k = {((Number(fbCur.cost_of_sales)/Number(fbCur.revenue))*100).toFixed(1)}% of F&amp;B revenue.
                  </p>
                </>
              )}
              {utilCur > 0 && (
                <>
                  <h4>Utilities</h4>
                  <p>
                    Utilities <strong>${(utilCur/1000).toFixed(1)}k</strong>
                    {utilPrior > 0 && (
                      <> vs ${(utilPrior/1000).toFixed(1)}k prior — {utilCur >= utilPrior ? '+' : ''}{(((utilCur - utilPrior)/utilPrior)*100).toFixed(0)}% MoM.</>
                    )}{' '}
                    {Math.abs(((utilCur - utilPrior)/Math.max(utilPrior, 1))*100) > 15 ? 'Material change — energy audit recommended.' : 'Within normal range.'}
                  </p>
                </>
              )}
            </div>
            <div className="comm-foot">
              <button type="button" className="btn primary" disabled>Save draft</button>
              <button type="button" className="btn" disabled>Approve &amp; publish to Audit Trail</button>
              <button type="button" className="btn" disabled>Email to owner (queue)</button>
            </div>
          </div>
        </div>
      </div>

      {/* ============== BLOCK 9 — Guardrails banner ============== */}
      <div className="guard">
        <b>Agent guardrails — finance writes are always approval-required.</b>{' '}
        Until the GL→USALI mapping is locked and variance-materiality thresholds are calibrated against
        12 months of close data, every agent-proposed reclassification or commentary publication requires
        explicit human approval. After validation, only Tier-1 actions (defined criteria, ≥85% confidence,
        audit-logged) move to auto. <b>P&amp;L policy: Tier-1 auto disabled — financial reporting always Tier-2.</b>
      </div>

      {/* ============== BLOCK 10 — 12-month rollup ============== */}
      <TwelveMonthPanel rows={twelveMonth} fy={fy2026} demand={demandFy} />

      <div className="legend-foot">
        <div style={{ marginBottom: 8 }}><b>WIRED (real numbers from gl.* + governance.*):</b></div>
        <div style={{ marginBottom: 12 }}>
          KPI strip: Total Revenue · GOP $ / margin / EBITDA · Labour % / F&amp;B labour % / Distribution cost % · A&amp;G $ · Revenue vs LY · USALI mapping gaps.
          USALI grid: Actual column · LY column for departmental rev/expense (via <code>pnl_snapshot</code> + class-inferred dept) · Δ% column (vs prior month).
          Right panels: Top variances waterfall (MoM dept profit) · Margin leak heatmap (last 5 months dept profit + A&amp;G overhead) · Variance commentary (template w/ live numbers).
          Tactical alerts: F&amp;B cost % · Labour cost % · A&amp;G MoM · Utilities MoM (computed from current vs prior month, threshold-gated).
          Decision queue: live from <code>governance.decision_queue</code>, empty-state when no items.
        </div>
        <div style={{ marginBottom: 8 }}><b>NOT WIRED (still <code>xx</code>):</b></div>
        <div>
          Cash on hand (no bank feed integration) · USALI grid Budget / Δ Bgt / Flow columns (no <code>gl.budgets</code> table) · LY breakdown for undistributed lines (pnl_snapshot lacks subcat split for A&amp;G/POM/etc.).
          Edit account-class assignments for <code>not_specified</code> entries at <a href="/finance/mapping" style={{ color: 'var(--brass)', textDecoration: 'underline' }}>/finance/mapping</a>.
        </div>
      </div>
    </div>
  );
}
