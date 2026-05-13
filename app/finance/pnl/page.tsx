// app/finance/pnl/page.tsx
// Finance · USALI P&L — full IA layout per proposal 2026-04-30.
// Branded skin (cream / forest-green / tan) sampled from /revenue/pulse.
// Wired tiles use Supabase data; unwired tiles render with "Data needed" badges
// referencing the schema gap (1–8) blocking them. See deploy-doc-schema-finance-pnl-2026-04-30.md.

import React from 'react';
import { getKpiDaily, aggregateDaily } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import {
  getPlSections, getUsaliHouse, getUsaliDept, getUsaliPlBySubcat,
  getDqUnmappedCount, getPendingDecisions, periodsForWindow, currentPeriod, pickSection, pickPeriod,
  getLyTotalRevenue, getLyByDept, getLyByUsaliDept, getDeptByPeriods,
  getBudgetByPeriod, getBudgetVsActual, getScenarioStack,
  getLyLinesByPeriod, getForecastLinesByPeriod,
  getDriversByPeriod, getFreshnessSummary, getMaterialityThreshold,
  getDqSummary, getPayrollByPeriod, getDemandSummary,
  getCashForecast13w, getLatestCommentary,
} from '../_data';
import { priorPeriod, type PeriodWindow } from '@/lib/supabase-gl';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import KpiBox from '@/components/kpi/KpiBox';
import { FINANCE_SUBPAGES } from '../_subpages';
import TwelveMonthPanel from './TwelveMonthPanel';
import MonthDropdown from './MonthDropdown';
import CompareDropdown, { type CompareMode } from './CompareDropdown';
import CashForecastPanel from './CashForecastPanel';
import CommentaryPanel from './CommentaryPanel';

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
  const autoCur = periodsWithRev[0] || calCur;

  // Manual override: ?month=YYYY-MM (FY2026 only). Falls back to auto-detect when invalid/missing.
  const monthParam = (searchParams.month as string | undefined) || '';
  const monthValid = /^2026-(0[1-9]|1[0-2])$/.test(monthParam);
  const cur = monthValid ? monthParam : autoCur;
  const prior = priorPeriod(cur);

  // Dropdown options: Jan 2026 → latest closed month (auto). Always include
  // through the auto-detected latest so the user can flip back to "current".
  const monthOptions = (() => {
    const months: string[] = [];
    const [endY, endM] = autoCur.split('-').map(Number);
    for (let y = 2026, m = 1; (y < endY) || (y === endY && m <= endM); m += 1) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      if (m === 12) { y += 1; m = 0; }
    }
    return months;
  })();
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
    // 12 months ending in `cur` so heatmap covers a full FY at a glance.
    for (let i = 0; i < 12; i++) {
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
    getScenarioStack(fy2026),
    getLyLinesByPeriod(cur),       // Actuals 2025 same-month, keyed `${subcat}||${dept}`
    getForecastLinesByPeriod(cur), // Conservative 2026 cur-month
    getDriversByPeriod(cur),       // plan.drivers — room_nights/occ%/ADR for cur period
    getFreshnessSummary(),         // kpi.freshness_log rollup
    getMaterialityThreshold(),     // gl.materiality_thresholds (drives alert thresholds)
    getDqSummary(),                // dq.violations cross-pillar count
    getPayrollByPeriod(cur),       // ops.payroll_monthly for cur period (cross-check)
    getDemandSummary(fy2026),      // revenue.demand_calendar for FY2026
  ]);

  // Cash forecast (13-week) + latest LLM commentary draft for cur period
  const [cashForecast, latestCommentary] = await Promise.all([
    getCashForecast13w(),
    getLatestCommentary(cur),
  ]);
  const cashStartParam = Number((searchParams.cash0 as string | undefined) ?? '0');
  const cashStart = isFinite(cashStartParam) ? cashStartParam : 0;

  // Comparison mode (?compare=budget|forecast|ly) — controls which scenario
  // populates the "Budget"-coded columns in the main USALI grid + Δ math.
  const compareParam = (searchParams.compare as string | undefined) || 'budget';
  const compareMode: CompareMode = (compareParam === 'forecast' || compareParam === 'ly')
    ? compareParam : 'budget';
  const compareLabel = compareMode === 'forecast' ? 'Forecast'
                     : compareMode === 'ly'       ? 'Last Year'
                     : 'Budget';
  const compareSource = compareMode === 'forecast' ? 'plan.lines · Conservative 2026'
                      : compareMode === 'ly'       ? 'plan.lines · Actuals 2025'
                      : 'plan.lines · Budget 2026 v1';
  const compareCur: Record<string, number> = compareMode === 'forecast' ? forecastLines
                                            : compareMode === 'ly'      ? lyLines
                                            : budgetCur;

  // Driver lookups: budget vs actuals from plan.drivers.
  // PBS 2026-05-13 audit fix: v_drivers_stack returns one row per room-type
  // for room_nights / occupancy_pct (10 rows in 2026-04), not a house total.
  // .find() returned the first row — wrong number. Aggregate by driver_key:
  //   - room_nights → SUM (additive)
  //   - occupancy_pct → AVG (mean across room types; weighted average needs
  //                          capacity per type which the view doesn't expose)
  //   - adr_usd → AVG (single house row in practice, but AVG is safe)
  function pickDriver(scenario: string, key: string): number | null {
    const rows = drivers.filter(d => d.scenario_name === scenario && d.driver_key === key);
    if (rows.length === 0) return null;
    if (key === 'room_nights') {
      return rows.reduce((s, r) => s + Number(r.value_numeric || 0), 0);
    }
    // occupancy_pct + adr_usd → arithmetic mean.
    const sum = rows.reduce((s, r) => s + Number(r.value_numeric || 0), 0);
    return sum / rows.length;
  }
  const budgetRoomNights = pickDriver('Budget 2026 v1', 'room_nights');
  const budgetOccPct     = pickDriver('Budget 2026 v1', 'occupancy_pct');
  const budgetAdr        = pickDriver('Budget 2026 v1', 'adr_usd');
  // PBS 2026-05-13: 'Actuals 2026 YTD' scenario does not yet exist in
  // plan.drivers. Fall back to mv_kpi_daily aggregates (already fetched
  // as `agg`) so the Actual YTD KPIs are populated from real data.
  const aggAny: any = agg as any;
  const ytdRoomNights    = pickDriver('Actuals 2026 YTD', 'room_nights')
                           ?? (aggAny && aggAny.rooms_sold != null ? Number(aggAny.rooms_sold) : null);
  const ytdOccPct        = pickDriver('Actuals 2026 YTD', 'occupancy_pct')
                           ?? (aggAny && aggAny.occupancy_pct != null ? Number(aggAny.occupancy_pct) : null);
  const ytdAdr           = pickDriver('Actuals 2026 YTD', 'adr_usd')
                           ?? (aggAny && aggAny.adr != null ? Number(aggAny.adr) : null);
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
  // Top variances per dept — basis follows ?varBase= or active compareMode.
  const varianceBaseParam = (searchParams.varBase as string | undefined) ?? compareMode;
  const varianceBase: 'mom' | 'budget' | 'forecast' | 'ly' =
    (['mom','budget','forecast','ly'] as const).includes(varianceBaseParam as any)
      ? (varianceBaseParam as 'mom' | 'budget' | 'forecast' | 'ly') : 'mom';

  // Aggregate scenario_stack rows into dept-level departmental_profit for cur.
  const scenarioCur = (twelveMonth as any[]).filter(r => r.period_yyyymm === cur);
  function dpFromScenario(d: string, scenarioField: 'actual_usd' | 'budget_usd' | 'forecast_usd' | 'ly_usd'): number {
    let rev = 0, cogs = 0, pay = 0, opex = 0;
    for (const row of scenarioCur) {
      if ((row.usali_department || 'Undistributed') !== d) continue;
      const v = Number(row[scenarioField] || 0);
      if (row.usali_subcategory === 'Revenue')                    rev  += Math.abs(v);
      else if (row.usali_subcategory === 'Cost of Sales')         cogs += v;
      else if (row.usali_subcategory === 'Payroll & Related')     pay  += v;
      else if (row.usali_subcategory === 'Other Operating Expenses') opex += v;
    }
    return rev - cogs - pay - opex;
  }

  const VAR_LABEL: Record<typeof varianceBase, string> = {
    mom:      `${prior} → ${cur}`,
    budget:   'vs Budget',
    forecast: 'vs Forecast',
    ly:       'vs Last Year',
  };
  const variances = deptOrderForVariance
    .map(d => {
      const cur_ = deptCurMap.get(d);
      if (!cur_) return null;
      const curProfit = Number(cur_?.departmental_profit ?? 0);
      let baseProfit: number;
      if (varianceBase === 'mom') {
        baseProfit = Number(deptPriorMap.get(d)?.departmental_profit ?? 0);
      } else if (varianceBase === 'budget') {
        baseProfit = dpFromScenario(d, 'budget_usd');
      } else if (varianceBase === 'forecast') {
        baseProfit = dpFromScenario(d, 'forecast_usd');
      } else {
        baseProfit = dpFromScenario(d, 'ly_usd');
      }
      return { dept: d, delta: curProfit - baseProfit, curProfit, priorProfit: baseProfit };
    })
    .filter(Boolean) as { dept: string; delta: number; curProfit: number; priorProfit: number }[];
  variances.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const maxAbsVar = Math.max(1, ...variances.map(v => Math.abs(v.delta)));

  // === Heatmap: dept × last-5-months departmental_profit (in $k) =============
  const heatmapPeriodsRev = [...heatmapPeriods].reverse(); // oldest → newest
  // 6 operating depts + A&G overhead row.
  const heatmapDepts = ['Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated', 'A&G'] as const;
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

  const pnlEyebrow = [
    'Finance · P&L',
    `${monthLabel} (MTD)`,
    period.rangeLabel,
    freshness ? `data ${freshness.stale_count}/${freshness.matview_count} stale` : null,
    dqSummary ? `DQ ${dqSummary.open_total} open` : null,
    materiality ? `mat ${materiality.pct}% / $${materiality.abs_usd}` : null,
  ].filter(Boolean).join(' · ');

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'finance' as const });
  void ctx; // surface for future ArtifactActions wiring
  void fbOverPct; void priorLabel; void latestMonth; // computed but currently unused after refactor

  return (
    <Page
      eyebrow={pnlEyebrow}
      title={<>Profit &amp; loss · where the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>margin</em> lives.</>}
      subPages={FINANCE_SUBPAGES}
    >
      {/* PBS 2026-05-13: pnl-page wrapper brings back the 196 globals.css
          rules scoped to .pnl-page (variance bars, USALI table tones,
          warn-banner, etc.) that were lost when the page was rewrapped
          in <Page>. Single-class fix, no JSX restructure. */}
      <div className="pnl-page">
      {/* ─── 1. KPI TILES ─────────────────────────────────────────────── */}

      {/* Drivers row — volume / mix / rate */}
      {(budgetRoomNights != null || ytdRoomNights != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <KpiBox value={budgetRoomNights} unit="count" dp={0} label={`Budget RN · ${monthLabel}`} tooltip="plan.drivers · scenario=Budget 2026 v1 · room_nights" />
          <KpiBox value={ytdRoomNights} unit="count" dp={0} label="Actual YTD RN"
            compare={(ytdRoomNights != null && budgetRoomNights != null && budgetRoomNights > 0)
              ? { value: ((ytdRoomNights - budgetRoomNights) / budgetRoomNights) * 100, unit: 'pct', period: 'vs Bgt' }
              : undefined}
            tooltip="plan.drivers · scenario=Actuals 2026 YTD · room_nights" />
          <KpiBox value={budgetOccPct} unit="pct" label="Budget occupancy" tooltip="plan.drivers · Budget 2026 v1 · occupancy_pct" />
          <KpiBox value={ytdOccPct} unit="pct" label="Actual YTD occupancy"
            compare={(ytdOccPct != null && budgetOccPct != null)
              ? { value: ytdOccPct - budgetOccPct, unit: 'pp', period: 'vs Bgt' }
              : undefined}
            tooltip="plan.drivers · Actuals 2026 YTD · occupancy_pct" />
          <KpiBox value={budgetAdr} unit="usd" dp={0} label="Budget ADR" tooltip="plan.drivers · Budget 2026 v1 · adr_usd" />
          <KpiBox value={ytdAdr} unit="usd" dp={0} label="Actual YTD ADR"
            compare={(ytdAdr != null && budgetAdr != null && budgetAdr > 0)
              ? { value: ((ytdAdr - budgetAdr) / budgetAdr) * 100, unit: 'pct', period: 'vs Bgt' }
              : undefined}
            tooltip="plan.drivers · Actuals 2026 YTD · adr_usd" />
        </div>
      )}

      <div style={{ height: 10 }} />

      {/* Main KPI grid — P&L vitals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiBox value={totalRev} unit="usd" dp={0} label={`Total revenue · ${monthLabel}`}
          compare={priorTotalRev > 0 ? { value: revVsPriorPct, unit: 'pct', period: 'vs prior mo' } : undefined}
          tooltip={`Sum of gl.pl_sections.amount_usd where section='income' for ${cur}.`} />
        <KpiBox value={gop} unit="usd" dp={0} label="GOP $"
          state={gop == null ? 'data-needed' : 'live'}
          needs={gop == null ? 'load gl_entries' : undefined}
          tooltip="gl.v_usali_house_summary.gop — total revenue minus dept expenses minus undistributed operating expenses." />
        <KpiBox value={gopMargin} unit="pct" label="GOP margin"
          state={gopMargin == null ? 'data-needed' : 'live'}
          tooltip="gop ÷ total_revenue × 100." />
        <KpiBox value={ebitda} unit="usd" dp={0} label="EBITDA"
          state={ebitda == null ? 'data-needed' : 'live'}
          tooltip="gop − depreciation − interest − income_tax." />
        <KpiBox value={revVsLyPct} unit="pct" label="Revenue vs LY"
          state={revVsLyPct == null ? 'data-needed' : 'live'}
          needs={revVsLyPct == null ? 'no LY row' : undefined}
          tooltip="Current month revenue vs same month last year. Source: gl.pnl_snapshot." />
        <KpiBox value={null} unit="usd" label="Cash on hand"
          state="data-needed" needs="bank feed not connected"
          tooltip="Gap 4 — bank statement integration not yet wired." />
        <KpiBox value={labourPct} unit="pct" label="Labour cost %"
          state={labourPct == null ? 'data-needed' : 'live'}
          tooltip="Total payroll ÷ total revenue (closed-month scope). Target ≤ 35%." />
        <KpiBox value={fbLabourPct} unit="pct" label="F&B labour %"
          state={fbLabourPct == null ? 'data-needed' : 'live'}
          tooltip="F&B payroll ÷ F&B revenue. Industry norm 28–32%." />
        <KpiBox value={channelsCommissionPct ?? (agg && agg.commission_pct != null ? Number(agg.commission_pct) : null)} unit="pct" label="Distribution cost %"
          state={(channelsCommissionPct == null && (!agg || agg.commission_pct == null)) ? 'data-needed' : 'live'}
          tooltip="OTA commissions (gl.account_id 624*) ÷ total revenue." />
        <KpiBox value={agTotalWindow} unit="usd" dp={0} label="A&G $"
          state={agTotalWindow === 0 ? 'data-needed' : 'live'}
          tooltip="mv_usali_pl_monthly · A&G subcategory, closed-month scope." />
        <KpiBox value={dqUnmapped} unit="count" label="USALI mapping gaps" tooltip="DQ-04-UNMAPPED open violations. Fix at /finance/mapping." />
        {payrollMonth && (
          <KpiBox value={Number(payrollMonth.staff_count)} unit="count" label="Staff on roll"
            tooltip={`Payroll ${monthLabel}: $${(Number(payrollMonth.gross_payroll_usd) / 1000).toFixed(1)}k gross · ${payrollMonth.total_days_worked} days worked.`} />
        )}
      </div>

      {/* ─── 2. SELECTORS + DROPDOWNS ────────────────────────────────── */}
      <PeriodSelectorRow
        basePath="/finance/pnl"
        win={period.win}
        cmp={period.cmp}
        preserve={{ seg: period.seg, month: cur, compare: compareMode, varBase: varianceBase }}
        rightSlot={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <CompareDropdown value={compareMode} />
            <MonthDropdown value={cur} options={monthOptions} />
          </div>
        }
      />

      {/* ─── 3. GRAPHS ──────────────────────────────────────────────── */}

      <Panel title={`Top variances · ${VAR_LABEL[varianceBase]}`} eyebrow="v_usali_dept_summary">
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['mom', 'budget', 'forecast', 'ly'] as const).map((b) => {
            const active = varianceBase === b;
            const params = new URLSearchParams({
              ...(period.win !== '30d' ? { win: period.win } : {}),
              ...(period.cmp !== 'none' ? { cmp: period.cmp } : {}),
              ...(monthValid ? { month: cur } : {}),
              ...(compareMode !== 'budget' ? { compare: compareMode } : {}),
              ...(b !== 'mom' ? { varBase: b } : {}),
            });
            return (
              <a key={b} href={`/finance/pnl${params.toString() ? '?' + params.toString() : ''}`} style={{
                padding: '4px 12px', borderRadius: 4, border: '1px solid var(--paper-deep)',
                background: active ? 'var(--moss)' : 'var(--paper-warm)',
                color: active ? 'var(--paper-warm)' : 'var(--ink-soft)',
                fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                fontWeight: 600, textDecoration: 'none',
              }}>{b}</a>
            );
          })}
        </div>
        <div className="waterfall">
          {variances.length === 0 ? (
            <div className="meta" style={{ padding: 8 }}>No dept rows for {cur} or comparison base.</div>
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
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="13-week cash forecast" eyebrow="gl.v_cash_forecast_13w">
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginBottom: 8 }}>
          OTB reservations + AR aging − fixed costs (payroll/utilities/A&G) − supplier estimate. Override starting cash via <code>?cash0=</code>.
        </div>
        <CashForecastPanel rows={cashForecast} startingCash={cashStart} />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Margin leak heatmap" eyebrow={`$k dept profit · ${heatmapPeriodsRev[0]} → ${cur}`}>
        <div className="heatmap">
          {heatmapDepts.map(dept => (
            <React.Fragment key={`row-${dept}`}>
              <div className="hm-lbl">{dept}</div>
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
            </React.Fragment>
          ))}
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title={`Variance commentary · ${cur}`} eyebrow={latestCommentary ? 'LLM draft' : 'auto-draft'}>
        <CommentaryPanel
          period={cur}
          draftBody={latestCommentary?.body ?? null}
          draftCreatedAt={latestCommentary?.created_at ?? null}
          hasApiKey={Boolean(process.env.ANTHROPIC_API_KEY)}
          payload={{
            monthLabel,
            totalRev,
            priorTotalRev,
            revVsPriorPct,
            gop,
            gopMomDelta,
            gopMomPct,
            revVsLyPct,
            agTotal: topAg,
            agPrior,
            fbLabour,
            fbRev: fbRevWindow,
            fbLabourPct,
            fbCogsPct: fbCur && Number(fbCur.revenue) > 0 ? (Number(fbCur.cost_of_sales) / Number(fbCur.revenue)) * 100 : null,
            utilCur,
            utilPrior,
            occPct: ytdOccPct,
            adr: ytdAdr,
            topVariances: variances.slice(0, 4).map(v => ({ dept: v.dept, delta: v.delta })),
          }}
          fallback={
            <>
              <h4>Headline</h4>
              <p>
                {monthLabel} closes with revenue {totalRev > priorTotalRev ? 'up' : 'down'}{' '}
                <strong>{Math.abs(revVsPriorPct).toFixed(1)}%</strong> vs prior (${(totalRev/1000).toFixed(1)}k vs ${(priorTotalRev/1000).toFixed(1)}k).{' '}
                {gop != null ? <>GOP $${(gop/1000).toFixed(1)}k {gopMomDelta != null && gopMomPct != null && (
                  <>({gopMomDelta >= 0 ? '+' : '−'}${Math.abs(gopMomDelta/1000).toFixed(1)}k MoM, {gopMomPct >= 0 ? '+' : ''}{gopMomPct.toFixed(0)}%)</>
                )}.</> : <>GOP awaiting expense load.</>}
                {' '}{revVsLyPct != null ? <>vs LY: <strong>{revVsLyPct >= 0 ? '+' : ''}{revVsLyPct.toFixed(1)}%</strong>.</> : <>No LY comparable yet.</>}
              </p>
              {topAg > 0 && (
                <>
                  <h4>A&amp;G</h4>
                  <p>
                    A&amp;G ran <strong>${(topAg/1000).toFixed(1)}k</strong> this month (
                    {agPrior > 0 ? <>{topAg > agPrior ? 'up' : 'down'} {Math.abs(((topAg - agPrior)/agPrior)*100).toFixed(0)}% vs ${(agPrior/1000).toFixed(1)}k prior</> : 'no prior comparable'}
                    ). Top accounts in <a href="/finance/mapping">/finance/mapping</a>.
                  </p>
                </>
              )}
              {fbCur && Number(fbCur.revenue) > 0 && (
                <>
                  <h4>F&amp;B</h4>
                  <p>
                    F&amp;B labour <strong>${(fbLabour/1000).toFixed(1)}k</strong> vs revenue ${(fbRevWindow/1000).toFixed(1)}k → ratio{' '}
                    <strong>{fbLabourPct != null ? fbLabourPct.toFixed(1) : '—'}%</strong>{' '}
                    {fbLabourPct != null && (fbLabourPct > 35 ? '(above 28–32% norm)' : '(within 28–32% norm)')}.
                  </p>
                </>
              )}
            </>
          }
        />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="12-month rollup" eyebrow="actual · budget · forecast · ly">
        <TwelveMonthPanel rows={twelveMonth} fy={fy2026} demand={demandFy} />
      </Panel>

      {/* ─── 4. TABLES ──────────────────────────────────────────────── */}

      <div style={{ height: 14 }} />

      <Panel
        title={`USALI department schedule · ${monthLabel} (MTD) · vs ${compareLabel}`}
        eyebrow={compareSource}
      >
          <div className="meta">
            Materiality: 5% AND $1,000. Coloring — green ≤5% · amber 5–10% · red &gt;10% AND &gt;$1k.
            Expense rows tagged <b>Gap 2</b> until <code>gl.usali_expense_map</code> ships.
          </div>
          <table className="usali">
            <thead>
              <tr>
                <th>Line</th><th>Actual</th><th>{compareLabel}</th><th>LY</th><th>Δ {compareLabel}</th><th>Δ%</th><th>Flow</th>
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
                  const budget = compareCur[`Revenue||${r.name}`] ?? null;
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
                const revBudget = Object.entries(compareCur)
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
                  const expBudget = (compareCur[`Cost of Sales||${r.name}`] ?? 0)
                    + (compareCur[`Payroll & Related||${r.name}`] ?? 0)
                    + (compareCur[`Other Operating Expenses||${r.name}`] ?? 0);
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
                  const v = compareCur[`${subcat}||`];
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

                const budgetRev    = sumKeys(compareCur, REV_SC);
                const budgetDeptExp = sumKeys(compareCur, DEPT_EXP_SC);
                const budgetUndist = sumKeys(compareCur, UNDIST_SC);
                const budgetBelowGop = sumKeys(compareCur, BELOW_GOP_SC);
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
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="Decisions queued for you"
        eyebrow={`${decisions.length} pending · governance.decision_queue`}
      >
        {decisions.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            ✓ No pending decisions. Items appear here when P&amp;L Detector / Variance Composer / Controller / Procurement writes to <code>governance.decision_queue</code>.
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
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="Tactical alerts"
        eyebrow={`v_usali_dept_summary · period=${cur} · ${alerts.length === 0 ? 'all clean' : `${alerts.length} breach${alerts.length > 1 ? 'es' : ''}`}`}
      >
        <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginBottom: 10 }}>
          Thresholds: F&amp;B cost &gt; 32% · Labour &gt; 35% · A&amp;G or Utilities MoM &gt; ±{(matPct * 3).toFixed(0)}% (3× materiality).
        </div>
        {alerts.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
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
      </Panel>

      <div style={{ height: 18 }} />

      {/* ─── Policy notices ─────────────────────────────────────────── */}
      <div className="warn-banner">
        ⚠ <b>Cloudbeds write policy — pilot phase.</b>{' '}
        Agent-proposed reclassifications, JE proposals, and RFQs always require explicit human approval.
        Variance Composer never auto-publishes commentary. Controller Agent never posts to GL. Procurement
        Agent has no PO authority. After validation against 90 days of decisions, only Tier-1 actions
        (parity resync, &lt;$2k impact, ≥85% confidence) move to auto.
      </div>

      <div className="guard">
        <b>Agent guardrails — finance writes are always approval-required.</b>{' '}
        Until the GL→USALI mapping is locked and variance-materiality thresholds are calibrated against
        12 months of close data, every agent-proposed reclassification or commentary publication requires
        explicit human approval. After validation, only Tier-1 actions (defined criteria, ≥85% confidence,
        audit-logged) move to auto. <b>P&amp;L policy: Tier-1 auto disabled — financial reporting always Tier-2.</b>
      </div>

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
      </div>{/* /.pnl-page */}
    </Page>
  );
}
