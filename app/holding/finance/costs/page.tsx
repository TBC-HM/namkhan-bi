// app/holding/finance/costs/page.tsx
// Cost Governance Engine v2 — HOLDING executive cost dashboard.
// Brief cost-governance-v2 · ADR-196 full scope · owner findings 3-5 are the input.
//
// Owner questions this page answers (law 737):
//   1. WHERE did costs occur — which tenant, holding vs tenant, which module, build vs ops?
//   2. What did the platform cost this month, and is anything over budget?
//   3. What was allocated to each tenant, under which policy version?
//   4. What does each task family cost, and how much is retry/failure waste?
//   5. Is any closed period drifting (reproducibility)?
//
// Every figure traces to a view (metric truth law — zero hand-typed numbers):
//   WHERE matrix            → public.v_costs_where_matrix
//   summary tiles + trend   → public.v_costs_summary_monthly
//   allocation              → public.v_costs_allocation_status / v_costs_allocated_facts
//   budgets + alerts        → public.v_costs_budget_variance / v_costs_alerts
//   task costing + parity   → public.v_costs_task_costing / v_costs_task_run_parity
//   client requests         → public.v_costs_client_requests (chargeback data-only, ADR-197)
//   period closes + drift   → public.v_costs_period_closes
//   drill-to-source ledger  → public.v_costs_events_recent (immutable costs.cost_events)

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CostEntryForms from './_components/CostEntryForms';
import FindingButton from './_components/FindingButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SummaryRow {
  month: string; work_class: string; cost_nature: string;
  property_id: number | null; events: number; amount_usd: number;
  contains_estimates: boolean;
}
interface WhereRow {
  month: string; property_id: number | null; tenant: string;
  module_key: string; work_class: string; events: number; amount_usd: number;
}
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
  project_key: string | null; period_start: string; budget_usd: number;
  actual_usd: number; pct_used: number | null;
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

const PROPERTY_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
const usd = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;
const tenantLabel = (pid: number | null): string =>
  pid == null ? 'Platform' : PROPERTY_LABEL[pid] ?? String(pid);

export default async function HoldingCostsPage({ searchParams }: { searchParams?: { month?: string } }) {
  const sb = getSupabaseAdmin();
  const [sumRes, whereRes, allocRes, factRes, budRes, alertRes, taskRes, parityRes,
    reqRes, closeRes, evRes, buildRes, unallocRes] = await Promise.all([
    sb.from('v_costs_summary_monthly').select('*').order('month', { ascending: true }),
    sb.from('v_costs_where_matrix').select('*'),
    sb.from('v_costs_allocation_status').select('*').order('period', { ascending: false }).limit(12),
    sb.from('v_costs_allocated_facts').select('*').order('period', { ascending: false }).limit(24),
    sb.from('v_costs_budget_variance').select('*').order('period_start', { ascending: false }).limit(24),
    sb.from('v_costs_alerts').select('*').eq('status', 'open').order('triggered_at', { ascending: false }).limit(12),
    sb.from('v_costs_task_costing').select('*'),
    sb.from('v_costs_task_run_parity').select('*').order('month', { ascending: false }).limit(6),
    sb.from('v_costs_client_requests').select('*').order('created_at', { ascending: false }).limit(12),
    sb.from('v_costs_period_closes').select('*').order('period', { ascending: false }).limit(12),
    sb.from('v_costs_events_recent').select('*').limit(60),
    sb.from('v_costs_build_portfolio').select('*').order('month', { ascending: false }),
    sb.from('v_costs_unallocated').select('*').order('month', { ascending: false }),
  ]);
  if (sumRes.error) throw new Error(`v_costs_summary_monthly: ${sumRes.error.message}`);

  const summary = (sumRes.data ?? []) as SummaryRow[];
  const whereAll = (whereRes.data ?? []) as WhereRow[];
  const allocRuns = (allocRes.data ?? []) as AllocRunRow[];
  const allocFacts = (factRes.data ?? []) as AllocFactRow[];
  const budgets = (budRes.data ?? []) as BudgetRow[];
  const alerts = (alertRes.data ?? []) as AlertRow[];
  const taskCosts = (taskRes.data ?? []) as TaskCostRow[];
  const parity = (parityRes.data ?? []) as ParityRow[];
  const clientReqs = (reqRes.data ?? []) as ClientReqRow[];
  const closes = (closeRes.data ?? []) as CloseRow[];
  const events = (evRes.data ?? []) as EventRow[];
  const build = (buildRes.data ?? []) as BuildRow[];
  const unalloc = (unallocRes.data ?? []) as UnallocRow[];

  // ── Month picker (server-side links; ?month=YYYY-MM) ──
  const months = Array.from(new Set(summary.map((r) => r.month))).sort();
  const monthKeys = months.map((m) => m.slice(0, 7));
  const reqMonth = searchParams?.month;
  const selKey = reqMonth && monthKeys.includes(reqMonth) ? reqMonth : monthKeys[monthKeys.length - 1] ?? null;
  const selMonth = selKey ? months[monthKeys.indexOf(selKey)] : null;

  const monthPicker = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {monthKeys.slice(-6).map((mk) => (
        <a key={mk} href={`?month=${mk}`}
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

  // ── Headline (selected month) ──
  const cur = summary.filter((r) => r.month === selMonth);
  const curTotal = cur.reduce((s, r) => s + Number(r.amount_usd), 0);
  const allTotal = summary.reduce((s, r) => s + Number(r.amount_usd), 0);
  const curAi = cur.filter((r) => r.cost_nature === 'ai_inference').reduce((s, r) => s + Number(r.amount_usd), 0);
  const curTenant = cur.filter((r) => r.property_id != null).reduce((s, r) => s + Number(r.amount_usd), 0);
  const curUnalloc = unalloc.find((u) => u.month === selMonth);
  // finding 5 fix: unallocated renders 0, never a dead "—"
  const unallocPct = Number(curUnalloc?.unallocated_pct ?? 0);
  const openAlerts = alerts.length;

  const tiles: KpiTileProps[] = [
    { label: `Total cost · ${selKey ?? '—'}`, value: usd(curTotal), size: 'sm', status: 'green',
      footnote: 'public.v_costs_summary_monthly' },
    { label: 'All-time ledger', value: usd(allTotal), size: 'sm', status: 'grey',
      footnote: 'immutable costs.cost_events' },
    { label: `AI inference · ${selKey ?? '—'}`, value: usd(curAi), size: 'sm', status: 'green',
      footnote: 'cost_nature = ai_inference' },
    { label: 'Tenant-attributed', value: usd(curTenant), size: 'sm',
      status: curTenant > 0 ? 'green' : 'amber', footnote: 'events with property_id set' },
    { label: 'Unallocated %', value: `${unallocPct}%`, size: 'sm',
      status: unallocPct > 60 ? 'red' : unallocPct > 30 ? 'amber' : 'green',
      footnote: 'no property + no module — governance target ↓' },
    { label: 'Open budget alerts', value: String(openAlerts), size: 'sm',
      status: openAlerts > 0 ? 'red' : 'green', footnote: 'public.v_costs_alerts · thresholds 80/100/120%' },
  ];

  // ── WHERE matrix (owner question 1) ──
  const whereCur = whereAll.filter((w) => w.month === selMonth)
    .sort((a, b) => Number(b.amount_usd) - Number(a.amount_usd));
  const whereTotal = whereCur.reduce((s, r) => s + Number(r.amount_usd), 0);
  const whereRows = whereCur.slice(0, 20).map((w) => ({
    tenant: w.tenant, module: w.module_key.replace(/_/g, ' '), work_class: w.work_class.replace(/_/g, ' '),
    events: String(w.events), amount: usd(Number(w.amount_usd), 4),
    share: whereTotal > 0 ? `${((100 * Number(w.amount_usd)) / whereTotal).toFixed(1)}%` : '—',
  }));
  const whereCols: ChartSeries[] = [
    { key: 'module', label: 'Module' }, { key: 'work_class', label: 'Work class' },
    { key: 'events', label: 'Events' }, { key: 'amount', label: 'USD' }, { key: 'share', label: 'Share' },
  ];

  // ── Monthly trend stacked by work class ──
  const classKeys = Array.from(new Set(summary.map((r) => r.work_class)));
  const trendData = months.map((m) => {
    const row: Record<string, string | number> = { month: m.slice(0, 7) };
    for (const k of classKeys) {
      row[k] = Math.round(summary.filter((r) => r.month === m && r.work_class === k)
        .reduce((s, r) => s + Number(r.amount_usd), 0) * 100) / 100;
    }
    return row;
  });

  // ── Allocation (owner question 3) ──
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

  // ── Budgets (owner question 2) ──
  const budgetRows = budgets.map((b) => ({
    scope: b.scope_type === 'tenant' ? `tenant · ${tenantLabel(b.property_id)}`
      : b.scope_type === 'module' ? `module · ${b.module_key ?? '?'}`
      : b.scope_type === 'project' ? `project · ${b.project_key ?? '?'}` : 'platform',
    period: b.period_start.slice(0, 7), budget: usd(Number(b.budget_usd)), actual: usd(Number(b.actual_usd), 4),
    used: b.pct_used == null ? '—' : `${b.pct_used}%`,
  }));
  const budgetCols: ChartSeries[] = [
    { key: 'period', label: 'Period' }, { key: 'budget', label: 'Budget USD' },
    { key: 'actual', label: 'Actual USD' }, { key: 'used', label: '% used' },
  ];

  // ── Task costing (owner question 4) ──
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

  // ── Client requests / chargeback preview (ADR-197 data-only) ──
  const reqRows = clientReqs.map((c) => ({
    tenant: c.tenant, title: c.title, status: c.approval_status, rule: c.billable_rule,
    estimate: usd(c.estimate_usd), incurred: usd(Number(c.incurred_usd), 4),
    margin: usd(c.margin_usd),
  }));
  const reqCols: ChartSeries[] = [
    { key: 'title', label: 'Request' }, { key: 'status', label: 'Status' }, { key: 'rule', label: 'Billable rule' },
    { key: 'estimate', label: 'Estimate' }, { key: 'incurred', label: 'Incurred' }, { key: 'margin', label: 'Margin' },
  ];

  // ── Period closes + drift (owner question 5) ──
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

  // ── Build portfolio ──
  const buildRows = build.slice(0, 12).map((b) => ({
    initiative: b.initiative, month: b.month.slice(0, 7),
    labor: usd(b.labor_usd), ai: usd(b.ai_usd), total: usd(b.total_usd),
  }));
  const buildCols: ChartSeries[] = [
    { key: 'month', label: 'Month' }, { key: 'labor', label: 'Labor USD' },
    { key: 'ai', label: 'AI USD' }, { key: 'total', label: 'Total USD' },
  ];

  // ── Ledger drill ──
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
    { key: 'item', label: 'Item' },
    { key: 'amount', label: 'USD' }, { key: 'src', label: 'Drill source' },
  ];

  return (
    <DashboardPage
      title="Finance · Costs — enterprise view"
      subtitle="Cost Governance Engine v2 · ADR-196 full scope · immutable ledger · allocation + budgets + task costing + period close"
    >
      <Container title="Cost headline" subtitle={selKey ? `month of ${selKey}` : 'ledger empty'}
        density="compact" action={<FindingButton />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title={`Where did costs occur · ${selKey ?? '—'}`}
        subtitle="tenant × module × work class · public.v_costs_where_matrix · drill: ledger table at page bottom"
        action={monthPicker}>
        <Chart variant="table" data={whereRows} xKey="tenant" series={whereCols}
          empty={{ title: 'No cost events this month', hint: 'ingest runs hourly (costs-ingest-hourly)' }} />
      </Container>

      <Container title="Monthly cost by work class" subtitle="ops vs build vs tenant vs special-request — separately reportable (MD §19)">
        <Chart
          variant="stacked_bar"
          data={trendData}
          xKey="month"
          series={classKeys.map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))}
          height={260}
          empty={{ title: 'No cost events yet', hint: 'ingest runs hourly (costs-ingest-hourly)' }}
        />
      </Container>

      <Container title="Allocation runs" subtitle="shared platform cost → tenants · versioned policies (costs.allocation_policies) · MD §6.5">
        <Chart variant="table" data={allocRows} xKey="policy" series={allocCols}
          empty={{ title: 'No allocation runs yet', hint: 'run: SELECT costs.fn_run_allocation(policy_id, month, post)' }} />
      </Container>

      <Container title="Allocated to tenants" subtitle="public.v_costs_allocated_facts · each fact carries policy version + share basis (reproducible)">
        <Chart variant="table" data={factRows} xKey="tenant" series={factCols}
          empty={{ title: 'No allocated facts yet', hint: 'facts appear when an allocation run executes' }} />
      </Container>

      <Container title="Budgets vs actual" subtitle="public.v_costs_budget_variance · alerts at 80/100/120% (MD §12) · checked on every hourly ingest">
        <Chart variant="table" data={budgetRows} xKey="scope" series={budgetCols}
          empty={{ title: 'No budgets defined yet', hint: 'seed costs.budgets (platform / tenant / module / project scope) — alerts arm automatically' }} />
      </Container>

      <Container title={`Task costing · ${selKey ?? '—'}`}
        subtitle={`public.v_costs_task_costing · runs from costs.task_runs (scheduler wired; agent-run linkage in transition — ledger parity ${curParity?.parity_pct ?? 0}%)`}>
        <Chart variant="table" data={taskRows} xKey="family" series={taskCols}
          empty={{ title: 'No task runs this month', hint: 'task_runs ingest from scheduled_task_runs on the hourly cron' }} />
      </Container>

      <Container title="Client requests · chargeback preview" subtitle="costs.client_requests · estimate vs incurred vs margin · billing EXECUTION gated until first external client (ADR-197) — structures live, data-only">
        <Chart variant="table" data={reqRows} xKey="tenant" series={reqCols}
          empty={{ title: 'No client special requests', hint: 'client_special_request work requires a client_request row (constraint-enforced) — none exist yet, honestly empty' }} />
      </Container>

      <Container title="Period closes" subtitle="public.v_costs_period_closes · snapshot vs live recompute — drift ≠ 0 means closed-period source data changed (MD §12 alert class)">
        <Chart variant="table" data={closeRows} xKey="period" series={closeCols}
          empty={{ title: 'No closed periods yet', hint: 'close a past month: SELECT costs.fn_close_period(date, actor)' }} />
      </Container>

      <Container title="Manual capture" subtitle="infra / SaaS charges + PBS build hours · bridges fn_costs_add_infra_charge / fn_costs_log_build_labor · ingested into the ledger on submit">
        <CostEntryForms />
      </Container>

      <Container title="Build portfolio" subtitle="work_class = platform_build · labor from costs.build_labor_log at price-book rates · capex candidates for DD">
        <Chart variant="table" data={buildRows} xKey="initiative" series={buildCols}
          empty={{ title: 'No build cost captured yet', hint: 'log PBS hours in costs.build_labor_log' }} />
      </Container>

      <Container title="Recent cost events (drill-to-source)" subtitle="public.v_costs_events_recent · every amount names its source row — MD §19: every displayed amount drills to source events">
        <Chart variant="table" data={eventRows} xKey="at" series={eventCols} empty={{ title: 'Ledger empty' }} />
      </Container>
    </DashboardPage>
  );
}
