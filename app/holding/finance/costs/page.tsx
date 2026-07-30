// app/holding/finance/costs/page.tsx
// Cost Governance Engine v1 — HOLDING executive cost dashboard
// (brief cost-governance-v1 · owner answer 2026-07-30: "Full ledger now").
//
// Every figure traces to a view (metric truth law — zero hand-typed numbers):
//   summary tiles + trend   → public.v_costs_summary_monthly
//   tenant unit economics   → public.v_costs_tenant_unit_economics
//   build portfolio         → public.v_costs_build_portfolio
//   unallocated governance  → public.v_costs_unallocated
//   drill-to-source ledger  → public.v_costs_events_recent (immutable costs.cost_events)
//   source reconciliation   → public.v_costs_sources_reconciliation
//
// Ledger is append-only; corrections are reversal rows. AI amounts are
// upstream-calculated (cockpit_audit_log / ai_token_meter); price-book row
// attached at ingestion for provenance (recalc reconciliation = Phase 2).

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CostEntryForms from './_components/CostEntryForms';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SummaryRow {
  month: string; work_class: string; cost_nature: string;
  property_id: number | null; events: number; amount_usd: number;
  contains_estimates: boolean;
}
interface TenantRow {
  property_id: number; month: string; events: number;
  ai_cost_usd: number | null; total_cost_usd: number; cost_per_event_usd: number | null;
}
interface BuildRow { month: string; initiative: string; labor_usd: number | null; ai_usd: number | null; total_usd: number }
interface UnallocRow { month: string; unallocated_usd: number | null; total_usd: number; unallocated_pct: number | null }
interface EventRow {
  id: number; event_at: string; cost_nature: string; work_class: string;
  property_id: number | null; module_key: string | null; provider: string | null; item: string | null;
  amount_usd: number; is_estimate: boolean; source_table: string; source_id: string;
  note: string | null;
}
interface ReconRow { source: string; source_total_usd: number | null; ledger_total_usd: number | null }
interface ModuleRow { month: string; module_key: string; events: number; amount_usd: number }

const PROPERTY_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
const usd = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;
const tenantLabel = (pid: number | null): string =>
  pid == null ? 'Platform' : PROPERTY_LABEL[pid] ?? String(pid);

export default async function HoldingCostsPage() {
  const sb = getSupabaseAdmin();
  const [sumRes, tenRes, buildRes, unallocRes, evRes, reconRes, modRes] = await Promise.all([
    sb.from('v_costs_summary_monthly').select('*').order('month', { ascending: true }),
    sb.from('v_costs_tenant_unit_economics').select('*').order('month', { ascending: false }),
    sb.from('v_costs_build_portfolio').select('*').order('month', { ascending: false }),
    sb.from('v_costs_unallocated').select('*').order('month', { ascending: false }),
    sb.from('v_costs_events_recent').select('*').limit(60),
    sb.from('v_costs_sources_reconciliation').select('*'),
    sb.from('v_costs_module_monthly').select('*').order('month', { ascending: false }),
  ]);
  if (sumRes.error) throw new Error(`v_costs_summary_monthly: ${sumRes.error.message}`);

  const summary = (sumRes.data ?? []) as SummaryRow[];
  const tenants = (tenRes.data ?? []) as TenantRow[];
  const build = (buildRes.data ?? []) as BuildRow[];
  const unalloc = (unallocRes.data ?? []) as UnallocRow[];
  const events = (evRes.data ?? []) as EventRow[];
  const recon = (reconRes.data ?? []) as ReconRow[];
  const modules = (modRes.data ?? []) as ModuleRow[];

  const months = Array.from(new Set(summary.map((r) => r.month))).sort();
  const curMonth = months[months.length - 1] ?? null;
  const cur = summary.filter((r) => r.month === curMonth);
  const curTotal = cur.reduce((s, r) => s + Number(r.amount_usd), 0);
  const allTotal = summary.reduce((s, r) => s + Number(r.amount_usd), 0);
  const curByClass = new Map<string, number>();
  for (const r of cur) curByClass.set(r.work_class, (curByClass.get(r.work_class) ?? 0) + Number(r.amount_usd));
  const curAi = cur.filter((r) => r.cost_nature === 'ai_inference').reduce((s, r) => s + Number(r.amount_usd), 0);
  const curTenant = cur.filter((r) => r.property_id != null).reduce((s, r) => s + Number(r.amount_usd), 0);
  const curUnalloc = unalloc.find((u) => u.month === curMonth);

  const tiles: KpiTileProps[] = [
    { label: `Total cost · ${curMonth ?? '—'}`, value: usd(curTotal), size: 'sm', status: 'green',
      footnote: 'public.v_costs_summary_monthly' },
    { label: 'All-time ledger', value: usd(allTotal), size: 'sm', status: 'grey',
      footnote: `${events.length >= 60 ? '60+' : events.length} recent events shown below` },
    { label: `AI inference · ${curMonth ?? '—'}`, value: usd(curAi), size: 'sm', status: 'green',
      footnote: 'cost_nature = ai_inference' },
    { label: 'Tenant-attributed', value: usd(curTenant), size: 'sm',
      status: curTenant > 0 ? 'green' : 'amber', footnote: 'events with property_id set' },
    { label: 'Unallocated %', value: curUnalloc?.unallocated_pct == null ? '—' : `${curUnalloc.unallocated_pct}%`,
      size: 'sm',
      status: curUnalloc?.unallocated_pct == null ? 'grey' : curUnalloc.unallocated_pct > 60 ? 'red' : curUnalloc.unallocated_pct > 30 ? 'amber' : 'green',
      footnote: 'no property + no module — governance target ↓' },
  ];

  // Monthly trend stacked by work class
  const classKeys = Array.from(new Set(summary.map((r) => r.work_class)));
  const trendData = months.map((m) => {
    const row: Record<string, string | number> = { month: m.slice(0, 7) };
    for (const k of classKeys) {
      row[k] = Math.round(summary.filter((r) => r.month === m && r.work_class === k)
        .reduce((s, r) => s + Number(r.amount_usd), 0) * 100) / 100;
    }
    return row;
  });

  const classRows = Array.from(curByClass.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ work_class: k, amount: usd(v), share: curTotal > 0 ? `${((100 * v) / curTotal).toFixed(1)}%` : '—' }));
  const classCols: ChartSeries[] = [
    { key: 'amount', label: 'USD' }, { key: 'share', label: 'Share' },
  ];

  const tenantRows = tenants.slice(0, 12).map((t) => ({
    tenant: tenantLabel(t.property_id), month: t.month.slice(0, 7),
    events: String(t.events), ai: usd(t.ai_cost_usd), total: usd(t.total_cost_usd),
    per_event: usd(t.cost_per_event_usd, 4),
  }));
  const tenantCols: ChartSeries[] = [
    { key: 'month', label: 'Month' }, { key: 'events', label: 'Events' },
    { key: 'ai', label: 'AI USD' }, { key: 'total', label: 'Total USD' },
    { key: 'per_event', label: 'Cost / event' },
  ];

  const buildRows = build.slice(0, 12).map((b) => ({
    initiative: b.initiative, month: b.month.slice(0, 7),
    labor: usd(b.labor_usd), ai: usd(b.ai_usd), total: usd(b.total_usd),
  }));
  const buildCols: ChartSeries[] = [
    { key: 'month', label: 'Month' }, { key: 'labor', label: 'Labor USD' },
    { key: 'ai', label: 'AI USD' }, { key: 'total', label: 'Total USD' },
  ];

  const reconRows = recon.map((r) => ({
    source: r.source, source_total: usd(r.source_total_usd), ledger_total: usd(r.ledger_total_usd),
    delta: r.source_total_usd == null || r.ledger_total_usd == null ? '—'
      : usd(Number(r.source_total_usd) - Number(r.ledger_total_usd)),
  }));
  const reconCols: ChartSeries[] = [
    { key: 'source_total', label: 'Source USD' }, { key: 'ledger_total', label: 'Ledger USD' },
    { key: 'delta', label: 'Δ (dedup / not ingested)' },
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
    { key: 'item', label: 'Item' },
    { key: 'amount', label: 'USD' }, { key: 'src', label: 'Drill source' },
  ];

  // Module attribution (ADR-196 "costs visible on all platform levels"):
  // current month per module, from public.v_costs_module_monthly (view-level
  // enrichment covers historical events — ledger rows are never updated).
  const curModules = modules.filter((m) => curMonth != null && m.month === curMonth)
    .sort((a, b) => Number(b.amount_usd) - Number(a.amount_usd));
  const moduleRows = curModules.map((m) => ({
    module: m.module_key.replace(/_/g, ' '), events: String(m.events), amount: usd(Number(m.amount_usd)),
    share: curTotal > 0 ? `${((100 * Number(m.amount_usd)) / curTotal).toFixed(1)}%` : '—',
  }));
  const moduleCols: ChartSeries[] = [
    { key: 'events', label: 'Events' }, { key: 'amount', label: 'USD' }, { key: 'share', label: 'Share' },
  ];

  return (
    <DashboardPage
      title="Finance · Costs — enterprise view"
      subtitle="Cost Governance Engine v1 · immutable ledger costs.cost_events · four cost classes · corrections = reversal rows, never edits"
    >
      <Container title="Cost headline" subtitle={curMonth ? `month of ${curMonth.slice(0, 7)}` : 'ledger empty'} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Monthly cost by work class" subtitle="platform_operations · platform_build · tenant_operations · client_special_request + governance classes">
        <Chart
          variant="stacked_bar"
          data={trendData}
          xKey="month"
          series={classKeys.map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))}
          height={260}
          formatY={(v) => `$${v}`}
          empty={{ title: 'No cost events yet', hint: 'ingest runs hourly (costs-ingest-hourly)' }}
        />
      </Container>

      <Container title={`Work-class breakdown · ${curMonth?.slice(0, 7) ?? '—'}`} subtitle="ops vs build vs tenant vs special-request — separately reportable (acceptance §19)">
        <Chart variant="table" data={classRows} xKey="work_class" series={classCols} empty={{ title: 'No events this month' }} />
      </Container>

      <Container title={`Module attribution · ${curMonth?.slice(0, 7) ?? '—'}`} subtitle="public.v_costs_module_monthly · costs.module_map agent/task→module · historical events enriched at view level (ledger immutable)">
        <Chart variant="table" data={moduleRows} xKey="module" series={moduleCols} empty={{ title: 'No module-attributed cost this month' }} />
      </Container>

      <Container title="Manual capture" subtitle="infra / SaaS charges + PBS build hours · bridges fn_costs_add_infra_charge / fn_costs_log_build_labor · ingested into the ledger on submit">
        <CostEntryForms />
      </Container>

      <Container title="Tenant unit economics" subtitle="public.v_costs_tenant_unit_economics · contribution margin joins revenue at monetization-engine build">
        <Chart variant="table" data={tenantRows} xKey="tenant" series={tenantCols} empty={{ title: 'No tenant-attributed cost yet' }} />
      </Container>

      <Container title="Build portfolio" subtitle="work_class = platform_build · labor from costs.build_labor_log at price-book rates · capex candidates for DD">
        <Chart variant="table" data={buildRows} xKey="initiative" series={buildCols} empty={{ title: 'No build cost captured yet', hint: 'log PBS hours in costs.build_labor_log' }} />
      </Container>

      <Container title="Source reconciliation" subtitle="ledger vs capture systems · Δ on ai_token_meter = rows deduped against audit log · governance.agent_runs excluded v1 (overlap risk, logged decision)">
        <Chart variant="table" data={reconRows} xKey="source" series={reconCols} empty={{ title: 'No sources' }} />
      </Container>

      <Container title="Recent cost events (drill-to-source)" subtitle="public.v_costs_events_recent · every amount names its source row — acceptance: every displayed amount drills to source events">
        <Chart variant="table" data={eventRows} xKey="at" series={eventCols} empty={{ title: 'Ledger empty' }} />
      </Container>
    </DashboardPage>
  );
}
