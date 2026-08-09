// app/holding/finance/costs/page.tsx
// Cost Governance Engine v2 — HOLDING executive cost dashboard.
// Brief cost-governance-v2 · ADR-196 full scope · owner findings 3-5 are the input.
//
// §3b OWNER AMENDMENT (PBS 2026-08-05, ADR-230): redesigned to the house pattern
// (/marketing/youtube/dashboard): SUBTABS across the top · KPI TILE ROW (max 6, sm,
// Overview only — "Today est. USD" reads public.v_spend_today.total_est_usd, never
// metered_usd alone) · THREE GRAPHS under the tiles · containers below on their own
// subtab, and ONLY when they have rows — an empty container is a lie about coverage;
// empty state = one line naming what would fill it.
//
// SPEND LIMITS container (owner control, ADR-230) lives on the Budgets subtab and
// writes real dials via public.fn_spend_limits_set — enforced by
// governance.fn_spend_guard() on cron spend-guard-5min, not intentions.
// ADR-230 objects are CONSUMED, not duplicated: governance.spend_limits ·
// public.v_spend_today · public.v_automation_state · public.fn_spend_limits_set().
//
// Every figure traces to a view (metric truth law — zero hand-typed numbers):
//   daily spend line        → public.v_costs_daily
//   today / builder sessions→ public.v_spend_today (metered + reconstructed builder spend)
//   WHERE matrix            → public.v_costs_where_matrix
//   summary + trend         → public.v_costs_summary_monthly
//   allocation              → public.v_costs_allocation_status / v_costs_allocated_facts
//   budgets + alerts        → public.v_costs_budget_variance_v2 / v_costs_budget_sources / v_costs_budget_monthly / v_costs_alerts
//   WHERE-matrix drill      → row click → ?tenant=&module=&work_class=&month= → v_costs_events_recent filtered (slice C)
//   task costing + parity   → public.v_costs_task_costing / v_costs_task_run_parity
//   client requests         → public.v_costs_client_requests (chargeback data-only, ADR-197)
//   period closes + drift   → public.v_costs_period_closes
//   drill-to-source ledger  → public.v_costs_events_recent (immutable costs.cost_events)

import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CostEntryForms from './_components/CostEntryForms';
import FindingButton from './_components/FindingButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Row types ────────────────────────────────────────────────────────────
interface SummaryRow {
  month: string; work_class: string; cost_nature: string;
  property_id: number | null; events: number; amount_usd: number;
  contains_estimates: boolean;
}
interface WhereRow {
  month: string; property_id: number | null; tenant: string;
  module_key: string; work_class: string; events: number; amount_usd: number;
}
interface DailyRow { day: string; amount_usd: number; ai_usd: number | null; events: number }
interface AllocRunRow {
  run_id: number; policy: string; policy_version: number; method: string;
  period: string; status: string; input_total_usd: number | null; allocated_total_usd: number | null;
}
interface AllocFactRow {
  period: string; tenant: string; amount_usd: number; policy: string; policy_version: number;
  basis: { share_pct?: number } | null;
}
interface BudgetRow {
  budget_id: number; scope_type: string; property_id: number | null; module_key: string | null;
  project_key: string | null; period_start: string; budget_usd: number; version: number | null;
  approved_by: string | null; note: string | null; actual_usd: number; forecast_usd: number | null;
  pct_used: number | null; pct_forecast: number | null; threshold_band: string | null;
}
interface BudgetSourceRow {
  source: string; scope_type: string; property_id: number | null; module_key: string | null;
  project_key: string | null; period_kind: string; period_start: string | null;
  amount_usd: number; version: number | null; approved_by: string | null;
  active: boolean; agent_note: string | null;
}
interface BudgetMonthlyRow {
  month: string; scope_type: string | null; module_key: string | null;
  budget_usd: number | null; actual_usd: number | null; forecast_usd: number | null;
}
interface AlertRow {
  id: number; period: string; threshold_pct: number; pct: number | null; status: string;
  scope_type: string | null; property_id: number | null; module_key: string | null;
}
interface TaskCostRow {
  month: string; task_family: string; module_key: string; runs: number; failed_runs: number;
  cost_usd: number | null; failed_cost_usd: number | null; avg_cost_per_run: number | null;
}
interface ParityRow { month: string; ledger_usd: number; task_attached_usd: number; parity_pct: number | null }
interface ClientReqRow {
  id: number; tenant: string; title: string; approval_status: string; billable_rule: string;
  estimate_usd: number | null; agreed_price_usd: number | null; incurred_usd: number; margin_usd: number | null;
}
interface CloseRow {
  period: string; closed_at: string; closed_by: string | null; total_usd: number;
  events_count: number; drift_usd: number | null;
}
interface EventRow {
  id: number; event_at: string; cost_nature: string; work_class: string;
  property_id: number | null; module_key: string | null; provider: string | null; item: string | null;
  amount_usd: number; is_estimate: boolean; source_table: string; source_id: string;
  note: string | null;
}
interface BuildRow { month: string; initiative: string; labor_usd: number | null; ai_usd: number | null; total_usd: number }
interface UnallocRow { month: string; unallocated_usd: number | null; total_usd: number; unallocated_pct: number | null }
interface AppYtdRow {
  app: string; ytd_usd: number; ytd_metered_usd: number | null; ytd_invoiced_usd: number | null;
  mtd_usd: number | null; events: number; last_event_at: string | null;
}
interface AiUsageMonthlyRow {
  month: string; provider_key: string; model_key: string; calls: number;
  input_units: number; cached_input_units: number; output_units: number; cost_usd: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const PROPERTY_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
const usd = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;
const tenantLabel = (pid: number | null): string =>
  pid == null ? 'Platform' : PROPERTY_LABEL[pid] ?? String(pid);

type TabKey = 'overview' | 'spend' | 'budgets' | 'allocation' | 'build' | 'close';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview',   label: 'Overview' },
  { key: 'spend',      label: 'Spend' },
  { key: 'budgets',    label: 'Budgets' },
  { key: 'allocation', label: 'Allocation' },
  { key: 'build',      label: 'Build' },
  { key: 'close',      label: 'Close' },
];

const HAIR = '#E6DFCC';
const INK_M = '#5A5A5A';
const FOREST = '#084838';

function SubTabs({ current, month }: { current: TabKey; month: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${HAIR}`, marginBottom: 4, flexWrap: 'wrap' }}>
      {TABS.map((t) => {
        const active = t.key === current;
        const href = `/holding/finance/costs?tab=${t.key}${month ? `&month=${month}` : ''}`;
        return (
          <Link key={t.key} href={href} style={{
            padding: '8px 14px', fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase',
            textDecoration: 'none',
            color: active ? FOREST : INK_M,
            borderBottom: active ? `2px solid ${FOREST}` : '2px solid transparent',
            fontWeight: active ? 700 : 500, marginBottom: -1,
          }}>{t.label}</Link>
        );
      })}
    </div>
  );
}

// §3b rule: never render an empty container — one line names what would fill it.
function EmptyLine({ what }: { what: string }) {
  return (
    <div style={{ fontSize: 12, color: INK_M, padding: '6px 2px', borderBottom: `1px dashed ${HAIR}` }}>
      {what}
    </div>
  );
}

// ─── Server actions (ADR-230 dials — same contract as it2/system/automation) ──
async function setLimitsAction(formData: FormData) {
  'use server';
  const num = (k: string, d: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v >= 0 ? v : d;
  };
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_spend_limits_set', {
    p_max_day: num('max_day', 400),
    p_warn_day: num('warn_day', 250),
    p_max_brief: num('max_brief', 40),
    p_max_module: num('max_module', 150),
    p_actor: 'PBS',
  });
  revalidatePath('/holding/finance/costs');
}

export default async function HoldingCostsPage({ searchParams }: {
  searchParams?: { tab?: string; month?: string; tenant?: string; module?: string; work_class?: string };
}) {
  const sb = getSupabaseAdmin();
  const tab: TabKey = (TABS.some((t) => t.key === searchParams?.tab) ? searchParams?.tab : 'overview') as TabKey;

  // ── Drill filter (slice C): WHERE-matrix cell → ledger filtered by tenant+module+work_class+month.
  // URL params keep the filtered view shareable/bookmarkable.
  const drillTenant = searchParams?.tenant ?? null;       // 'Namkhan' | 'Donna' | 'Platform'
  const drillModule = searchParams?.module ?? null;       // raw module_key
  const drillClass = searchParams?.work_class ?? null;    // raw work_class
  const drillActive = Boolean(drillTenant || drillModule || drillClass);
  const TENANT_TO_PID: Record<string, number | null> = { Namkhan: 260955, Donna: 1000001, Platform: null };

  const [sumRes, whereRes, dailyRes, spendTodayRes, autoStateRes, allocRes, factRes, budRes,
    budMonRes, alertRes, taskRes, parityRes, reqRes, closeRes, evRes, buildRes, unallocRes,
    appYtdRes, aiUseRes, budSrcRes] = await Promise.all([
    sb.from('v_costs_summary_monthly').select('*').order('month', { ascending: true }),
    sb.from('v_costs_where_matrix').select('*'),
    sb.from('v_costs_daily').select('*').order('day', { ascending: true }),
    (sb as any).from('v_spend_today').select('*').limit(1),
    (sb as any).from('v_automation_state').select('*').limit(1),
    sb.from('v_costs_allocation_status').select('*').order('period', { ascending: false }).limit(12),
    sb.from('v_costs_allocated_facts').select('*').order('period', { ascending: false }).limit(24),
    sb.from('v_costs_budget_variance_v2').select('*').order('period_start', { ascending: false }).limit(24),
    sb.from('v_costs_budget_monthly').select('*').order('month', { ascending: false }).limit(48),
    sb.from('v_costs_alerts').select('*').eq('status', 'open').order('triggered_at', { ascending: false }).limit(12),
    sb.from('v_costs_task_costing').select('*'),
    sb.from('v_costs_task_run_parity').select('*').order('month', { ascending: false }).limit(6),
    sb.from('v_costs_client_requests').select('*').order('created_at', { ascending: false }).limit(12),
    sb.from('v_costs_period_closes').select('*').order('period', { ascending: false }).limit(12),
    (() => {
      // Drill-filtered ledger: exactly the events behind the clicked WHERE-matrix cell.
      let q: any = sb.from('v_costs_events_recent').select('*');
      if (drillTenant && drillTenant in TENANT_TO_PID) {
        const pid = TENANT_TO_PID[drillTenant];
        q = pid == null ? q.is('property_id', null) : q.eq('property_id', pid);
      }
      if (drillModule) q = q.eq('module_key', drillModule);
      if (drillClass) q = q.eq('work_class', drillClass);
      if (drillActive && searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month)) {
        const start = `${searchParams.month}-01`;
        const [y, m] = searchParams.month.split('-').map(Number);
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
        q = q.gte('event_at', start).lt('event_at', next);
      }
      return q.limit(drillActive ? 200 : 60);
    })(),
    sb.from('v_costs_build_portfolio').select('*').order('month', { ascending: false }),
    sb.from('v_costs_unallocated').select('*').order('month', { ascending: false }),
    sb.from('v_costs_app_ytd').select('*').order('ytd_usd', { ascending: false }),
    sb.from('v_costs_ai_usage_monthly').select('*').order('month', { ascending: false }).limit(36),
    sb.from('v_costs_budget_sources').select('*').order('source', { ascending: true }),
  ]);
  if (sumRes.error) throw new Error(`v_costs_summary_monthly: ${sumRes.error.message}`);

  const summary = (sumRes.data ?? []) as SummaryRow[];
  const whereAll = (whereRes.data ?? []) as WhereRow[];
  const daily = (dailyRes.data ?? []) as DailyRow[];
  const spendToday: any = spendTodayRes.data?.[0] ?? {};
  const autoState: any = autoStateRes.data?.[0] ?? {};
  const allocRuns = (allocRes.data ?? []) as AllocRunRow[];
  const allocFacts = (factRes.data ?? []) as AllocFactRow[];
  const budgets = (budRes.data ?? []) as BudgetRow[];
  const budgetMonthly = (budMonRes.data ?? []) as BudgetMonthlyRow[];
  const alerts = (alertRes.data ?? []) as AlertRow[];
  const taskCosts = (taskRes.data ?? []) as TaskCostRow[];
  const parity = (parityRes.data ?? []) as ParityRow[];
  const clientReqs = (reqRes.data ?? []) as ClientReqRow[];
  const closes = (closeRes.data ?? []) as CloseRow[];
  const events = (evRes.data ?? []) as EventRow[];
  const build = (buildRes.data ?? []) as BuildRow[];
  const unalloc = (unallocRes.data ?? []) as UnallocRow[];
  const appYtd = (appYtdRes.data ?? []) as AppYtdRow[];
  const aiUsage = (aiUseRes.data ?? []) as AiUsageMonthlyRow[];
  const budgetSources = (budSrcRes.data ?? []) as BudgetSourceRow[];

  // ── Month picker (?tab=…&month=YYYY-MM) ──
  const months = Array.from(new Set(summary.map((r) => r.month))).sort();
  const monthKeys = months.map((m) => m.slice(0, 7));
  const reqMonth = searchParams?.month;
  const selKey = reqMonth && monthKeys.includes(reqMonth) ? reqMonth : monthKeys[monthKeys.length - 1] ?? null;
  const selMonth = selKey ? months[monthKeys.indexOf(selKey)] : null;

  const monthPicker = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {monthKeys.slice(-6).map((mk) => (
        <a key={mk} href={`?tab=${tab}&month=${mk}`}
          style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6, textDecoration: 'none',
            border: '1px solid var(--hairline, #E6DFCC)',
            background: mk === selKey ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
            color: mk === selKey ? '#fff' : 'var(--ink, #1B1B1B)',
          }}>
          {mk}
        </a>
      ))}
    </div>
  );

  // ── KPI tiles (§3b: max 6, sm, Overview only) ──
  const todayEst = Number(spendToday.total_est_usd ?? 0); // MUST be total_est_usd, never metered_usd alone
  const maxDay = Number(spendToday.max_usd_per_day ?? 400);
  const warnDay = Number(spendToday.warn_usd_per_day ?? 250);
  const builderSessions = Number(spendToday.builder_sessions ?? 0);

  const curCalKey = new Date().toISOString().slice(0, 7);
  const mtdTotal = summary.filter((r) => r.month.slice(0, 7) === curCalKey)
    .reduce((s, r) => s + Number(r.amount_usd), 0);

  const curBudgets = budgets.filter((b) => b.period_start.slice(0, 7) === curCalKey);
  const budTotal = curBudgets.reduce((s, b) => s + Number(b.budget_usd), 0);
  const budActual = curBudgets.reduce((s, b) => s + Number(b.actual_usd), 0);
  const vsBudget = budTotal > 0 ? Math.round((100 * budActual) / budTotal) : null;

  const curUnalloc = unalloc.find((u) => u.month.slice(0, 7) === curCalKey) ?? unalloc[0];
  const unallocPct = Number(curUnalloc?.unallocated_pct ?? 0);
  const openAlerts = alerts.length;

  const tiles: KpiTileProps[] = [
    { label: 'Today est. USD', value: usd(todayEst), size: 'sm',
      status: todayEst >= maxDay ? 'red' : todayEst >= warnDay ? 'amber' : 'green',
      footnote: `v_spend_today · metered + builder est · ceiling ${usd(maxDay, 0)}` },
    { label: 'Month-to-date', value: usd(mtdTotal), size: 'sm', status: 'grey',
      footnote: `${curCalKey} · v_costs_summary_monthly` },
    { label: 'vs budget', value: vsBudget == null ? '—' : `${vsBudget}%`, size: 'sm',
      status: vsBudget == null ? 'grey' : vsBudget > 100 ? 'red' : vsBudget > 80 ? 'amber' : 'green',
      footnote: vsBudget == null ? 'no budgets seeded yet (owner G2)'
        : `actual / budget · this month${budgets.some((b) => b.approved_by == null && b.period_start.slice(0, 7) === curCalKey) ? ' · DRAFT baseline' : ''}` },
    { label: 'Builder sessions today', value: String(builderSessions), size: 'sm',
      status: 'grey', footnote: 'v_spend_today · >60s only' },
    { label: 'Unallocated %', value: `${unallocPct}%`, size: 'sm',
      status: unallocPct > 60 ? 'red' : unallocPct > 30 ? 'amber' : 'green',
      footnote: 'no property + no module — governance target ↓' },
    { label: 'Open alerts', value: String(openAlerts), size: 'sm',
      status: openAlerts > 0 ? 'red' : 'green', footnote: 'v_costs_alerts · 80/100/120%' },
  ];

  // ── Three graphs (§3b) ──
  const last30 = daily.slice(-30).map((d) => ({
    day: d.day.slice(5, 10), usd: Math.round(Number(d.amount_usd) * 100) / 100,
  }));

  const curCal = summary.filter((r) => r.month.slice(0, 7) === curCalKey);
  const donutSrc = curCal.length > 0 ? curCal : summary.filter((r) => r.month === selMonth);
  const classAgg = new Map<string, number>();
  for (const r of donutSrc) classAgg.set(r.work_class, (classAgg.get(r.work_class) ?? 0) + Number(r.amount_usd));
  const donutData = Array.from(classAgg.entries())
    .map(([k, v]) => ({ label: k.replace(/_/g, ' '), usd: Math.round(v * 100) / 100 }))
    .sort((a, b) => b.usd - a.usd);

  const whereSrcMonth = whereAll.some((w) => w.month.slice(0, 7) === curCalKey)
    ? whereAll.filter((w) => w.month.slice(0, 7) === curCalKey)
    : whereAll.filter((w) => w.month === selMonth);
  const moduleKeys = Array.from(new Set(whereSrcMonth.map((w) => w.module_key))).slice(0, 6);
  const tenantAgg = new Map<string, Record<string, string | number>>();
  for (const w of whereSrcMonth) {
    if (!moduleKeys.includes(w.module_key)) continue;
    const row = tenantAgg.get(w.tenant) ?? { tenant: w.tenant };
    row[w.module_key] = Math.round(((Number(row[w.module_key]) || 0) + Number(w.amount_usd)) * 100) / 100;
    tenantAgg.set(w.tenant, row);
  }
  const tenantBarData = Array.from(tenantAgg.values());

  // ── Table row builders (per subtab) ──
  const whereCur = whereAll.filter((w) => w.month === selMonth)
    .sort((a, b) => Number(b.amount_usd) - Number(a.amount_usd));
  const whereTotal = whereCur.reduce((s, r) => s + Number(r.amount_usd), 0);
  const whereRows = whereCur.slice(0, 20).map((w) => ({
    tenant: w.tenant, module: w.module_key.replace(/_/g, ' '), work_class: w.work_class.replace(/_/g, ' '),
    events: String(w.events), amount: usd(Number(w.amount_usd), 4),
    share: whereTotal > 0 ? `${((100 * Number(w.amount_usd)) / whereTotal).toFixed(1)}%` : '—',
    // raw keys for the drill link (slice C: every cell clicks through to the filtered ledger)
    _tenant: w.tenant, _module: w.module_key, _class: w.work_class,
    _href: `/holding/finance/costs?tab=spend${selKey ? `&month=${selKey}` : ''}` +
      `&tenant=${encodeURIComponent(w.tenant)}&module=${encodeURIComponent(w.module_key)}` +
      `&work_class=${encodeURIComponent(w.work_class)}`,
  }));

  const anthroYtd = Number(appYtd.find((a) => a.app === 'anthropic')?.ytd_usd ?? 0);
  const claudeGap = anthroYtd < 10000; // A-OWNER-1
  const appRows = appYtd.map((a) => ({
    app: a.app, ytd: usd(Number(a.ytd_usd), 2), mtd: usd(Number(a.mtd_usd ?? 0), 2),
    metered: usd(Number(a.ytd_metered_usd ?? 0), 2),
    invoiced: a.ytd_invoiced_usd == null ? 'none ingested' : usd(Number(a.ytd_invoiced_usd), 2),
    events: String(a.events),
  }));
  const appCols: ChartSeries[] = [
    { key: 'ytd', label: 'YTD USD' }, { key: 'mtd', label: 'This month' },
    { key: 'metered', label: 'Metered (per-call)' }, { key: 'invoiced', label: 'Invoiced' },
    { key: 'events', label: 'Events' },
  ];
  const aiUsageRows = aiUsage.slice(0, 14).map((u) => ({
    month: u.month.slice(0, 7), model: u.model_key, calls: String(u.calls),
    tokens_in: Number(u.input_units).toLocaleString('en-US'),
    tokens_out: Number(u.output_units).toLocaleString('en-US'),
    cost: usd(Number(u.cost_usd), 4),
  }));
  const aiUsageCols: ChartSeries[] = [
    { key: 'model', label: 'Model' }, { key: 'calls', label: 'Calls' },
    { key: 'tokens_in', label: 'Tokens in' }, { key: 'tokens_out', label: 'Tokens out' },
    { key: 'cost', label: 'Cost USD' },
  ];

  const eventRows = events.map((e) => ({
    at: e.event_at.slice(0, 16).replace('T', ' '),
    nature: e.cost_nature, work_class: e.work_class, tenant: tenantLabel(e.property_id),
    module: e.module_key ?? '—',
    item: [e.provider, e.item].filter(Boolean).join(' · '),
    amount: usd(e.amount_usd, 4),
    src: `${e.source_table.replace('public.', '')}#${e.source_id}${e.is_estimate ? ' (est)' : ''}`,
  }));
  const eventCols: ChartSeries[] = [
    { key: 'nature', label: 'Nature' }, { key: 'work_class', label: 'Class' },
    { key: 'tenant', label: 'Tenant' }, { key: 'module', label: 'Module' },
    { key: 'item', label: 'Item' }, { key: 'amount', label: 'USD' }, { key: 'src', label: 'Drill source' },
  ];

  const budgetRows = budgets.map((b) => ({
    scope: b.scope_type === 'tenant' ? `tenant · ${tenantLabel(b.property_id)}`
      : b.scope_type === 'module' ? `module · ${b.module_key ?? '?'}`
      : b.scope_type === 'project' ? `project · ${b.project_key ?? '?'}` : 'platform',
    period: b.period_start.slice(0, 7),
    budget: `${usd(Number(b.budget_usd))}${b.approved_by == null ? ' (DRAFT)' : ''}`,
    actual: usd(Number(b.actual_usd), 4),
    forecast: usd(b.forecast_usd == null ? null : Number(b.forecast_usd)),
    used: b.pct_used == null ? '—' : `${b.pct_used}%${b.threshold_band ? ` · ${b.threshold_band}` : ''}`,
    on_track: b.pct_forecast == null ? '—' : `${b.pct_forecast}%`,
  }));
  const budgetCols: ChartSeries[] = [
    { key: 'period', label: 'Period' }, { key: 'budget', label: 'Budget USD' },
    { key: 'actual', label: 'Actual MTD' }, { key: 'forecast', label: 'Forecast (run-rate)' },
    { key: 'used', label: '% used' }, { key: 'on_track', label: 'Forecast % of budget' },
  ];
  const hasDraftBudgets = budgets.some((b) => b.approved_by == null);

  const budSrcRows = budgetSources.map((s) => ({
    source: s.source,
    scope: s.scope_type === 'tenant' ? `tenant · ${tenantLabel(s.property_id)}`
      : s.scope_type === 'module' ? `module · ${s.module_key ?? '?'}`
      : s.scope_type === 'agent' ? `agent · ${(s.agent_note ?? '').split('.')[0] || 'agent'}`
      : s.scope_type,
    period: s.period_kind === 'month' ? (s.period_start?.slice(0, 7) ?? 'monthly') : s.period_kind,
    amount: usd(Number(s.amount_usd)),
    status: s.approved_by != null ? `approved · ${s.approved_by}` : s.source === 'costs.budgets' ? 'DRAFT — not owner-approved' : 'enforced cap',
  }));
  const budSrcCols: ChartSeries[] = [
    { key: 'scope', label: 'Scope' }, { key: 'period', label: 'Period' },
    { key: 'amount', label: 'USD' }, { key: 'status', label: 'Status' },
  ];
  const budMonRows = budgetMonthly.slice(0, 18).map((m) => ({
    month: m.month.slice(0, 7),
    scope: [m.scope_type, m.module_key].filter(Boolean).join(' · ') || 'all',
    budget: usd(m.budget_usd == null ? null : Number(m.budget_usd)),
    actual: usd(m.actual_usd == null ? null : Number(m.actual_usd), 4),
    forecast: usd(m.forecast_usd == null ? null : Number(m.forecast_usd)),
  }));
  const budMonCols: ChartSeries[] = [
    { key: 'scope', label: 'Scope' }, { key: 'budget', label: 'Budget' },
    { key: 'actual', label: 'Actual' }, { key: 'forecast', label: 'Forecast' },
  ];
  const alertRows = alerts.map((a) => ({
    period: a.period.slice(0, 7), threshold: `${a.threshold_pct}%`, pct: a.pct == null ? '—' : `${a.pct}%`,
    scope: [a.scope_type, a.module_key ?? (a.property_id != null ? tenantLabel(a.property_id) : null)]
      .filter(Boolean).join(' · ') || 'platform',
  }));
  const alertCols: ChartSeries[] = [
    { key: 'threshold', label: 'Threshold' }, { key: 'pct', label: 'Actual %' }, { key: 'scope', label: 'Scope' },
  ];

  const allocRows = allocRuns.map((r) => ({
    policy: `${r.policy} v${r.policy_version}`, period: r.period.slice(0, 7), method: r.method,
    status: r.status, input: usd(r.input_total_usd, 4), allocated: usd(r.allocated_total_usd, 4),
  }));
  const allocCols: ChartSeries[] = [
    { key: 'period', label: 'Period' }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' },
    { key: 'input', label: 'Shared input USD' }, { key: 'allocated', label: 'Allocated USD' },
  ];
  const factRows = allocFacts.slice(0, 12).map((f) => ({
    tenant: f.tenant, period: f.period.slice(0, 7), amount: usd(Number(f.amount_usd), 4),
    share: f.basis?.share_pct != null ? `${f.basis.share_pct}%` : '—',
    policy: `${f.policy} v${f.policy_version}`,
  }));
  const factCols: ChartSeries[] = [
    { key: 'period', label: 'Period' }, { key: 'amount', label: 'USD' },
    { key: 'share', label: 'Share' }, { key: 'policy', label: 'Policy' },
  ];
  const unallocRows = unalloc.slice(0, 12).map((u) => ({
    month: u.month.slice(0, 7), unallocated: usd(u.unallocated_usd == null ? 0 : Number(u.unallocated_usd), 4),
    total: usd(Number(u.total_usd), 4), pct: `${Number(u.unallocated_pct ?? 0)}%`,
  }));
  const unallocCols: ChartSeries[] = [
    { key: 'unallocated', label: 'Unallocated USD' }, { key: 'total', label: 'Total USD' }, { key: 'pct', label: '%' },
  ];

  const taskCur = taskCosts.filter((t) => t.month === selMonth)
    .sort((a, b) => Number(b.cost_usd ?? 0) - Number(a.cost_usd ?? 0));
  const taskRows = taskCur.slice(0, 14).map((t) => ({
    family: t.task_family, module: t.module_key.replace(/_/g, ' '),
    runs: String(t.runs), failed: String(t.failed_runs),
    cost: usd(Number(t.cost_usd ?? 0), 4), waste: usd(Number(t.failed_cost_usd ?? 0), 4),
    avg: usd(Number(t.avg_cost_per_run ?? 0), 4),
  }));
  const taskCols: ChartSeries[] = [
    { key: 'module', label: 'Module' }, { key: 'runs', label: 'Runs' }, { key: 'failed', label: 'Failed' },
    { key: 'cost', label: 'Cost USD' }, { key: 'waste', label: 'Failure waste' }, { key: 'avg', label: 'Avg / run' },
  ];
  const curParity = parity.find((p) => p.month === selMonth);

  const reqRows = clientReqs.map((c) => ({
    tenant: c.tenant, title: c.title, status: c.approval_status, rule: c.billable_rule,
    estimate: usd(c.estimate_usd), incurred: usd(Number(c.incurred_usd), 4), margin: usd(c.margin_usd),
  }));
  const reqCols: ChartSeries[] = [
    { key: 'title', label: 'Request' }, { key: 'status', label: 'Status' }, { key: 'rule', label: 'Billable rule' },
    { key: 'estimate', label: 'Estimate' }, { key: 'incurred', label: 'Incurred' }, { key: 'margin', label: 'Margin' },
  ];

  const buildRows = build.slice(0, 12).map((b) => ({
    initiative: b.initiative, month: b.month.slice(0, 7),
    labor: usd(b.labor_usd), ai: usd(b.ai_usd), total: usd(b.total_usd),
  }));
  const buildCols: ChartSeries[] = [
    { key: 'month', label: 'Month' }, { key: 'labor', label: 'Labor USD' },
    { key: 'ai', label: 'AI USD' }, { key: 'total', label: 'Total USD' },
  ];

  const closeRows = closes.map((c) => ({
    period: c.period.slice(0, 7), closed: c.closed_at.slice(0, 10), by: c.closed_by ?? '—',
    total: usd(Number(c.total_usd), 4), events: String(c.events_count),
    drift: c.drift_usd == null ? '—' : usd(Number(c.drift_usd), 4),
  }));
  const closeCols: ChartSeries[] = [
    { key: 'closed', label: 'Closed at' }, { key: 'by', label: 'By' },
    { key: 'total', label: 'Snapshot USD' }, { key: 'events', label: 'Events' },
    { key: 'drift', label: 'Drift vs live' },
  ];
  const parityRows = parity.map((p) => ({
    month: p.month.slice(0, 7), ledger: usd(Number(p.ledger_usd), 4),
    attached: usd(Number(p.task_attached_usd), 4), pct: p.parity_pct == null ? '—' : `${p.parity_pct}%`,
  }));
  const parityCols: ChartSeries[] = [
    { key: 'ledger', label: 'Ledger USD' }, { key: 'attached', label: 'Task-attached USD' }, { key: 'pct', label: 'Parity' },
  ];

  const classKeys = Array.from(new Set(summary.map((r) => r.work_class)));
  const trendData = months.map((m) => {
    const row: Record<string, string | number> = { month: m.slice(0, 7) };
    for (const k of classKeys) {
      row[k] = Math.round(summary.filter((r) => r.month === m && r.work_class === k)
        .reduce((s, r) => s + Number(r.amount_usd), 0) * 100) / 100;
    }
    return row;
  });

  const claudeBanner = claudeGap ? (
    <div style={{
      padding: '10px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
      border: '1px solid var(--status-red, #B3261E)', background: 'var(--status-red-bg, #FCEEEE)',
      color: 'var(--ink, #1B1B1B)',
    }}>
      <strong>Data gap — Claude spend incomplete.</strong> Platform-metered Claude API calls YTD: {usd(anthroYtd)}.
      Owner-reported Claude spend exceeds $10,000 — the difference is Claude subscription + console usage whose
      invoices are not ingested (no Anthropic rows in costs.infra_charges). Until those invoices are captured
      (Build tab → Manual capture), every Claude number on this page is metered API usage only, not total spend.
    </div>
  ) : null;

  const limitInput: React.CSSProperties = {
    width: 110, padding: '6px 8px', fontSize: 13,
    border: `1px solid ${HAIR}`, borderRadius: 4, background: '#FFFFFF', color: 'var(--ink, #1B1B1B)',
  };
  const limitLbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M,
  };

  return (
    <DashboardPage
      title="Finance · Costs — enterprise view"
      subtitle="Cost Governance Engine v2 · ADR-196 + ADR-230 · immutable ledger · one screen answers one question"
    >
      <div style={{ display: 'grid', gap: 16, gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SubTabs current={tab} month={selKey} />
          <FindingButton />
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
            </div>
            {claudeBanner}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
              <Container title="Spend · last 30 days" subtitle="public.v_costs_daily · immutable ledger, reversals net out">
                <Chart variant="line" data={last30} xKey="day"
                  series={[{ key: 'usd', label: 'USD' }]} height={240}
                  empty={{ title: 'No ledger events in 30 days', hint: 'costs-ingest-hourly fills this' }} />
              </Container>
              <Container title="Cost by work class" subtitle={`${curCal.length > 0 ? curCalKey : selKey ?? '—'} · build vs ops vs tenant vs special`}>
                <Chart variant="donut" data={donutData} xKey="label"
                  series={[{ key: 'usd', label: 'USD' }]} height={240}
                  empty={{ title: 'No cost events this month', hint: 'ingest runs hourly' }} />
              </Container>
              <Container title="Cost by tenant · module" subtitle={`${whereSrcMonth[0]?.month.slice(0, 7) ?? '—'} · public.v_costs_where_matrix`}>
                <Chart variant="stacked_bar" data={tenantBarData} xKey="tenant"
                  series={moduleKeys.map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))} height={240}
                  empty={{ title: 'No attributed costs this month', hint: 'module attribution stamps at ingest' }} />
              </Container>
            </div>
            <Container title="Monthly cost by work class" subtitle="all months · separately reportable (MD §19)">
              <Chart variant="stacked_bar" data={trendData} xKey="month"
                series={classKeys.map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))} height={240}
                empty={{ title: 'No cost events yet', hint: 'ingest runs hourly (costs-ingest-hourly)' }} />
            </Container>
          </>
        )}

        {/* ══ SPEND ══ */}
        {tab === 'spend' && (
          <>
            {claudeBanner}
            {appRows.length > 0 ? (
              <Container title="Applications — monthly + YTD"
                subtitle="per provider · public.v_costs_app_ytd · per-call detail: costs.ai_usage_events (owner MD §7)">
                <Chart variant="table" data={appRows} xKey="app" series={appCols} />
              </Container>
            ) : <EmptyLine what="Applications container fills when app costs enter the ledger (AI metering hourly · invoices via Build tab manual capture)." />}
            {aiUsageRows.length > 0 ? (
              <Container title="AI inference detail" subtitle="per model per month · costs.ai_usage_events">
                <Chart variant="table" data={aiUsageRows} xKey="month" series={aiUsageCols} />
              </Container>
            ) : <EmptyLine what="AI inference detail fills when costs.fn_ingest_ai_usage meters calls (hourly cron)." />}
            {whereRows.length > 0 ? (
              <Container title={`Where did costs occur · ${selKey ?? '—'}`}
                subtitle="tenant × module × work class · public.v_costs_where_matrix · click a row to drill into its ledger events"
                action={monthPicker}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                        {['Tenant', 'Module', 'Work class', 'Events', 'USD', 'Share'].map((h, i) => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: INK_M }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {whereRows.map((w, i) => {
                        const active = drillActive && drillTenant === w._tenant && drillModule === w._module && drillClass === w._class;
                        return (
                          <tr key={i} style={{ borderBottom: `1px dashed ${HAIR}`, background: active ? '#F0EDE2' : 'transparent' }}>
                            <td style={{ padding: '6px 8px' }}><Link href={w._href} style={{ color: FOREST, fontWeight: 600, textDecoration: 'none' }}>{w.tenant}</Link></td>
                            <td style={{ padding: '6px 8px' }}><Link href={w._href} style={{ color: 'inherit', textDecoration: 'none' }}>{w.module}</Link></td>
                            <td style={{ padding: '6px 8px' }}><Link href={w._href} style={{ color: 'inherit', textDecoration: 'none' }}>{w.work_class}</Link></td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w.events}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w.amount}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{w.share}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Container>
            ) : <EmptyLine what={`WHERE matrix has no cost events for ${selKey ?? 'this month'} — ingest runs hourly.`} />}
            {drillActive && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${FOREST}`, color: FOREST, fontWeight: 600 }}>
                  filtered by: {[drillTenant, drillModule?.replace(/_/g, ' '), drillClass?.replace(/_/g, ' '), selKey].filter(Boolean).join(' · ')}
                </span>
                <Link href={`/holding/finance/costs?tab=spend${selKey ? `&month=${selKey}` : ''}`}
                  style={{ color: INK_M, textDecoration: 'underline' }}>clear filter</Link>
              </div>
            )}
            {eventRows.length > 0 ? (
              <Container title={drillActive ? 'Ledger — filtered to selected cell' : 'Recent cost events (drill-to-source)'}
                subtitle="public.v_costs_events_recent · every amount names its source row (MD §19)">
                <Chart variant="table" data={eventRows} xKey="at" series={eventCols} />
              </Container>
            ) : drillActive ? (
              <EmptyLine what={`No events for ${[drillTenant, drillModule, drillClass].filter(Boolean).join(' / ')} in ${selKey ?? 'this month'}.`} />
            ) : <EmptyLine what="Ledger drill fills with costs.cost_events rows." />}
          </>
        )}

        {/* ══ BUDGETS ══ */}
        {tab === 'budgets' && (
          <>
            <Container title="Spend limits — enforced, not advisory"
              subtitle="governance.spend_limits · enforced by fn_spend_guard() on cron spend-guard-5min · ADR-230">
              <form action={setLimitsAction} style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={limitLbl}>Max USD / day</span>
                  <input style={limitInput} type="number" step="1" min="0" name="max_day" defaultValue={maxDay} />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={limitLbl}>Warn USD / day</span>
                  <input style={limitInput} type="number" step="1" min="0" name="warn_day" defaultValue={warnDay} />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={limitLbl}>Max USD / brief</span>
                  <input style={limitInput} type="number" step="1" min="0" name="max_brief"
                    defaultValue={Number(autoState.max_usd_per_brief ?? 40)} />
                </label>
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={limitLbl}>Max USD / module</span>
                  <input style={limitInput} type="number" step="1" min="0" name="max_module"
                    defaultValue={Number(autoState.max_usd_per_module ?? 150)} />
                </label>
                <button type="submit" style={{
                  fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 4, cursor: 'pointer',
                  border: 'none', background: '#1F3A2E', color: '#FFFFFF',
                }}>Save limits</button>
              </form>
              <p style={{ fontSize: 10.5, color: INK_M, margin: '12px 0 0' }}>
                Day ceiling turns automation off automatically · per-brief ceiling parks the brief with a question.
                Automation is {autoState.automation_enabled === true ? 'RUNNING' : 'STOPPED'} — master switch:
                {' '}<Link href="/holding/it2/system/automation">System → Automation</Link>.
                Est. ${Number(autoState.est_usd_per_session ?? 2)}/builder session until real task_runs metering lands.
              </p>
            </Container>
            {hasDraftBudgets && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                border: '1px solid var(--status-amber, #B57F0F)', background: 'var(--status-amber-bg, #FBF3E0)',
                color: 'var(--ink, #1B1B1B)',
              }}>
                <strong>Draft baseline — not owner-approved.</strong> Budget rows marked DRAFT were seeded
                automatically from trailing-3-month actuals (version 0, no approver) so variance and alerts are
                live instead of blank. Overwrite them here when real budget numbers exist; nothing downstream
                treats a draft as approved.
              </div>
            )}
            {budgetRows.length > 0 ? (
              <Container title="Budgets vs actual vs forecast"
                subtitle="public.v_costs_budget_variance_v2 · straight-line month-to-date run rate · alerts at 80/100/120% (MD §12)">
                <Chart variant="table" data={budgetRows} xKey="scope" series={budgetCols} />
              </Container>
            ) : <EmptyLine what="Budgets vs actual fills when costs.budgets is seeded (owner decision pending — options filed on brief cost-governance-v2)." />}
            {budSrcRows.length > 0 ? (
              <Container title="All budget sources — one surface"
                subtitle="public.v_costs_budget_sources · costs.budgets + governance.agent_budgets (read-mapped, not duplicated)">
                <Chart variant="table" data={budSrcRows} xKey="source" series={budSrcCols} />
              </Container>
            ) : <EmptyLine what="Budget sources fill from costs.budgets and governance.agent_budgets." />}
            {budMonRows.length > 0 ? (
              <Container title="Monthly budget overview" subtitle="budget vs actual vs forecast · public.v_costs_budget_monthly · MD §6.6">
                <Chart variant="table" data={budMonRows} xKey="month" series={budMonCols} />
              </Container>
            ) : <EmptyLine what="Monthly budget overview fills when budgets + forecasts exist." />}
            {alertRows.length > 0 ? (
              <Container title="Open budget alerts" subtitle="public.v_costs_alerts">
                <Chart variant="table" data={alertRows} xKey="period" series={alertCols} />
              </Container>
            ) : <EmptyLine what="No open budget alerts — alerts arm automatically once budgets are seeded." />}
          </>
        )}

        {/* ══ ALLOCATION ══ */}
        {tab === 'allocation' && (
          <>
            {allocRows.length > 0 ? (
              <Container title="Allocation runs" subtitle="shared platform cost → tenants · versioned policies · MD §6.5">
                <Chart variant="table" data={allocRows} xKey="policy" series={allocCols} />
              </Container>
            ) : <EmptyLine what="Allocation runs fill via SELECT costs.fn_run_allocation(policy_id, month, post)." />}
            {factRows.length > 0 ? (
              <Container title="Allocated to tenants" subtitle="public.v_costs_allocated_facts · each fact carries policy version + share basis">
                <Chart variant="table" data={factRows} xKey="tenant" series={factCols} />
              </Container>
            ) : <EmptyLine what="Allocated facts appear when an allocation run posts." />}
            {unallocRows.length > 0 ? (
              <Container title="Unallocated by month" subtitle="public.v_costs_unallocated · governance target ↓">
                <Chart variant="table" data={unallocRows} xKey="month" series={unallocCols} />
              </Container>
            ) : <EmptyLine what="Unallocated view fills with ledger months." />}
          </>
        )}

        {/* ══ BUILD ══ */}
        {tab === 'build' && (
          <>
            {buildRows.length > 0 ? (
              <Container title="Build portfolio" subtitle="work_class = platform_build · labor at price-book rates · capex candidates for DD">
                <Chart variant="table" data={buildRows} xKey="initiative" series={buildCols} />
              </Container>
            ) : <EmptyLine what="Build portfolio fills from platform_build events + costs.build_labor_log hours." />}
            {taskRows.length > 0 ? (
              <Container title={`Task costing · ${selKey ?? '—'}`}
                subtitle={`costs.task_runs · ledger parity ${curParity?.parity_pct ?? 0}% (linkage in transition)`}
                action={monthPicker}>
                <Chart variant="table" data={taskRows} xKey="family" series={taskCols} />
              </Container>
            ) : <EmptyLine what={`Task costing has no runs for ${selKey ?? 'this month'} — task_runs ingest hourly from schedulers.`} />}
            {reqRows.length > 0 ? (
              <Container title="Client requests · chargeback preview"
                subtitle="costs.client_requests · billing EXECUTION gated until first external client (ADR-197) — data-only">
                <Chart variant="table" data={reqRows} xKey="tenant" series={reqCols} />
              </Container>
            ) : <EmptyLine what="Client requests fill when client_special_request work is logged (constraint-enforced) — none yet, honestly empty." />}
            <Container title="Manual capture" subtitle="infra / SaaS charges + PBS build hours · fn_costs_add_infra_charge / fn_costs_log_build_labor">
              <CostEntryForms />
            </Container>
          </>
        )}

        {/* ══ CLOSE ══ */}
        {tab === 'close' && (
          <>
            {closeRows.length > 0 ? (
              <Container title="Period closes" subtitle="public.v_costs_period_closes · drift ≠ 0 means closed-period source data changed (MD §12)">
                <Chart variant="table" data={closeRows} xKey="period" series={closeCols} />
              </Container>
            ) : <EmptyLine what="Period closes fill via SELECT costs.fn_close_period(date, actor) — close past months monthly." />}
            {parityRows.length > 0 ? (
              <Container title="Ledger ↔ task-run parity" subtitle="public.v_costs_task_run_parity · transition coverage of the audit-log proxy retirement">
                <Chart variant="table" data={parityRows} xKey="month" series={parityCols} />
              </Container>
            ) : <EmptyLine what="Parity view fills as cost_events gain task_run linkage." />}
          </>
        )}
      </div>
    </DashboardPage>
  );
}
