// app/h/[property_id]/finance/costs/page.tsx
// Cost Governance Engine v1 — CLIENT (tenant-scoped) cost view.
// PBS placement correction 2026-07-29: cost engine gets BOTH surfaces —
// holding enterprise view AND per-property Administration → Costs
// (own usage, own unit economics; budgets join later).
//
// Every figure traces to a view:
//   tiles + trend  → public.v_costs_tenant_unit_economics (filtered to this property)
//   event drill    → public.v_costs_events_recent (filtered to this property)

import { notFound } from 'next/navigation';
import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

interface TenantRow {
  property_id: number; month: string; events: number;
  ai_cost_usd: number | null; total_cost_usd: number; cost_per_event_usd: number | null;
}
interface EventRow {
  id: number; event_at: string; cost_nature: string; work_class: string;
  property_id: number | null; provider: string | null; item: string | null;
  amount_usd: number; is_estimate: boolean; source_table: string; source_id: string;
  note: string | null;
}
interface WhereRow {
  month: string; property_id: number | null; tenant: string;
  module_key: string; work_class: string; events: number; amount_usd: number;
}
interface AllocFactRow {
  period: string; tenant: string; amount_usd: number; policy: string; policy_version: number;
  basis: { share_pct?: number } | null;
}

const usd = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;

export default async function TenantCostsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  const propertyLabel = KNOWN_LABEL[propertyId];

  const sb = getSupabaseAdmin();
  const [tenRes, evRes, whereRes, factRes] = await Promise.all([
    sb.from('v_costs_tenant_unit_economics').select('*')
      .eq('property_id', propertyId).order('month', { ascending: true }),
    sb.from('v_costs_events_recent').select('*')
      .eq('property_id', propertyId).limit(40),
    sb.from('v_costs_where_matrix').select('*')
      .eq('property_id', propertyId),
    sb.from('v_costs_allocated_facts').select('*')
      .eq('property_id', propertyId).order('period', { ascending: false }).limit(12),
  ]);
  if (tenRes.error) throw new Error(`v_costs_tenant_unit_economics: ${tenRes.error.message}`);

  const monthsRows = (tenRes.data ?? []) as TenantRow[];
  const events = (evRes.data ?? []) as EventRow[];
  const whereAll = (whereRes.data ?? []) as WhereRow[];
  const allocFacts = (factRes.data ?? []) as AllocFactRow[];
  const cur = monthsRows[monthsRows.length - 1] ?? null;
  const curMonth = cur?.month ?? null;

  // direct usage by module × work class, current month (mirrors holding WHERE matrix)
  const whereCur = whereAll.filter((w) => w.month === curMonth)
    .sort((a, b) => Number(b.amount_usd) - Number(a.amount_usd));
  const whereTotal = whereCur.reduce((s, r) => s + Number(r.amount_usd), 0);
  const whereRows = whereCur.slice(0, 12).map((w) => ({
    module: w.module_key.replace(/_/g, ' '), work_class: w.work_class.replace(/_/g, ' '),
    events: String(w.events), amount: usd(Number(w.amount_usd), 4),
    share: whereTotal > 0 ? `${((100 * Number(w.amount_usd)) / whereTotal).toFixed(1)}%` : '—',
  }));
  const whereCols: ChartSeries[] = [
    { key: 'work_class', label: 'Work class' }, { key: 'events', label: 'Events' },
    { key: 'amount', label: 'USD' }, { key: 'share', label: 'Share' },
  ];

  const factRows = allocFacts.map((f) => ({
    period: f.period.slice(0, 7), amount: usd(Number(f.amount_usd), 4),
    share: f.basis?.share_pct != null ? `${f.basis.share_pct}%` : '—',
    policy: `${f.policy} v${f.policy_version}`,
  }));
  const factCols: ChartSeries[] = [
    { key: 'amount', label: 'Allocated USD' }, { key: 'share', label: 'Share' },
    { key: 'policy', label: 'Policy version' },
  ];

  const tiles: KpiTileProps[] = [
    { label: `Cost · ${cur ? cur.month.slice(0, 7) : '—'}`, value: cur ? usd(cur.total_cost_usd) : '—',
      size: 'sm', status: cur ? 'green' : 'grey', footnote: 'public.v_costs_tenant_unit_economics' },
    { label: 'AI cost', value: cur ? usd(cur.ai_cost_usd) : '—', size: 'sm',
      status: cur ? 'green' : 'grey', footnote: 'cost_nature = ai_inference' },
    { label: 'Metered events', value: cur ? String(cur.events) : '—', size: 'sm',
      status: cur ? 'green' : 'grey', footnote: 'this month' },
    { label: 'Cost / event', value: cur ? usd(cur.cost_per_event_usd, 4) : '—', size: 'sm',
      status: cur ? 'green' : 'grey', footnote: 'unit economics baseline' },
  ];

  const trendData = monthsRows.map((r) => ({
    month: r.month.slice(0, 7),
    total: Math.round(Number(r.total_cost_usd) * 100) / 100,
    ai: Math.round(Number(r.ai_cost_usd ?? 0) * 100) / 100,
  }));

  const eventRows = events.map((e) => ({
    at: e.event_at.slice(0, 16).replace('T', ' '),
    nature: e.cost_nature, work_class: e.work_class,
    item: [e.provider, e.item].filter(Boolean).join(' · '),
    amount: usd(e.amount_usd, 4),
    src: `${e.source_table.replace('public.', '')}#${e.source_id}${e.is_estimate ? ' (est)' : ''}`,
  }));
  const eventCols: ChartSeries[] = [
    { key: 'nature', label: 'Nature' }, { key: 'work_class', label: 'Class' },
    { key: 'item', label: 'Item' }, { key: 'amount', label: 'USD' },
    { key: 'src', label: 'Drill source' },
  ];

  return (
    <DashboardPage
      title={`Administration · Costs · ${propertyLabel}`}
      subtitle="your platform usage at cost · immutable ledger costs.cost_events · budgets + chargeback follow at client milestone (Phase 2)"
      tabs={financeSubPagesForProperty(propertyId).map(s => ({ key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/finance/costs') }))}
    >
      <Container title="Usage headline" subtitle={cur ? `month of ${cur.month.slice(0, 7)}` : 'no attributed usage yet'} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Monthly cost trend" subtitle="total vs AI-inference share">
        <Chart
          variant="bar"
          data={trendData}
          xKey="month"
          series={[{ key: 'total', label: 'Total USD' }, { key: 'ai', label: 'AI USD' }]}
          height={220}
          empty={{ title: 'No attributed cost yet', hint: 'agent runs for this property appear after the hourly ingest' }}
        />
      </Container>

      <Container title={`Usage by module · ${curMonth ? curMonth.slice(0, 7) : '—'}`}
        subtitle="direct usage attributed to this property · public.v_costs_where_matrix">
        <Chart variant="table" data={whereRows} xKey="module" series={whereCols}
          empty={{ title: 'No attributed usage this month', hint: 'agent runs for this property appear after the hourly ingest' }} />
      </Container>

      <Container title="Allocated shared platform cost"
        subtitle="your share of shared platform cost · versioned policy · public.v_costs_allocated_facts">
        <Chart variant="table" data={factRows} xKey="period" series={factCols}
          empty={{ title: 'No allocations posted yet', hint: 'shared cost is split by the active allocation policy at month end' }} />
      </Container>

      <Container title="Recent cost events (drill-to-source)" subtitle="every amount names its source row">
        <Chart variant="table" data={eventRows} xKey="at" series={eventCols} empty={{ title: 'No events for this property yet' }} />
      </Container>
    </DashboardPage>
  );
}
