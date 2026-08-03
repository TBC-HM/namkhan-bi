// app/holding/commercial/page.tsx
// Monetization Engine v2 — the commercial operating system (brief monetization-engine-v2 §2.4, A12).
// Owner contract: dms de6b767a (18-section MD) + 764bcbca (owner SQL) + 69a6d4a4 (workbook).
// Surfaces: Business Model Designer · Executive monetization · Customer economics ·
//           Free-plan economics · Revenue assurance · Capex recovery.
// Every figure traces to a public bridge over commercial.* (metric truth law):
//   v_commercial_exec / v_commercial_catalog / v_commercial_plan_entitlements /
//   v_commercial_contracts / v_commercial_rated_usage / v_commercial_wallets /
//   v_commercial_assurance / v_commercial_capex / v_commercial_meters
// Revenue-state discipline (MD §2.15): every amount here is SHADOW-rated — no bare
// "revenue" label anywhere; billed/recognized states stay empty until client #1 (ADR-197).
// v1 surface at /holding/finance/monetization (catalogue + shadow margins) remains live.

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CommercialActions from './CommercialActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ExecRow {
  tenant_slug: string; tenant: string;
  shadow_mrr_usd: number; shadow_usage_month_usd: number;
  net_billable_month_usd: number; cost_month_usd: number;
}
interface CatalogRow {
  product_code: string; name: string; product_kind: string; version: number;
  version_status: string; price_book: string | null; charge_type: string | null;
  price_model: string | null; billing_interval: string | null; meter_code: string | null;
  unit_amount: number | null; included_quantity: number | null; markup_percent: number | null;
}
interface EntRow { product_code: string; entitlement_code: string; entitlement_value: unknown }
interface ContractRow {
  tenant: string; contract_number: string; status: string; currency: string;
  price_book: string | null; product_code: string | null; discount_percent: number | null;
}
interface RatedRow {
  tenant_slug: string; meter_code: string; quantity: number; occurred_at: string;
  rating_version: string; gross_amount: number; credit_amount: number;
  net_billable_amount: number; calculation_trace: {
    tier_calc?: { method?: string }; resolution?: { source?: string };
  } | null;
}
interface WalletRow { tenant_slug: string; currency: string; balance: number; credits_granted: number; credits_consumed: number }
interface AssuranceRow { check_code: string; tenant_slug: string | null; entity_type: string | null; detected_at: string }
interface CapexRow {
  project_code: string; name: string; status: string; linked_cost_usd: number;
  assessments: number; asset_code: string | null; carrying_amount: number | null;
}
interface MeterRow { meter_code: string; name: string; unit: string }

const usd = (n: number | null | undefined): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default async function HoldingCommercialPage() {
  const sb = getSupabaseAdmin();
  const [execRes, catRes, entRes, conRes, ratedRes, walletRes, assurRes, capexRes, meterRes] = await Promise.all([
    sb.from('v_commercial_exec').select('*'),
    sb.from('v_commercial_catalog').select('*').order('product_code'),
    sb.from('v_commercial_plan_entitlements').select('*').order('product_code'),
    sb.from('v_commercial_contracts').select('*').order('tenant'),
    sb.from('v_commercial_rated_usage').select('*').order('occurred_at', { ascending: false }).limit(50),
    sb.from('v_commercial_wallets').select('*'),
    sb.from('v_commercial_assurance').select('*').order('detected_at', { ascending: false }).limit(50),
    sb.from('v_commercial_capex').select('*').order('project_code'),
    sb.from('v_commercial_meters').select('meter_code,name,unit').eq('active', true).order('meter_code'),
  ]);

  const exec = (execRes.data ?? []) as ExecRow[];
  const catalog = (catRes.data ?? []) as CatalogRow[];
  const planEnts = (entRes.data ?? []) as EntRow[];
  const contracts = (conRes.data ?? []) as ContractRow[];
  const rated = ((ratedRes.data ?? []) as RatedRow[]).filter((r) => !r.rating_version.endsWith('-replay'));
  const wallets = (walletRes.data ?? []) as WalletRow[];
  const assurance = (assurRes.data ?? []) as AssuranceRow[];
  const capex = (capexRes.data ?? []) as CapexRow[];
  const meters = (meterRes.data ?? []) as MeterRow[];

  const totMrr = exec.reduce((s, r) => s + Number(r.shadow_mrr_usd), 0);
  const totUsage = exec.reduce((s, r) => s + Number(r.shadow_usage_month_usd), 0);
  const totNet = exec.reduce((s, r) => s + Number(r.net_billable_month_usd), 0);
  const totCost = exec.reduce((s, r) => s + Number(r.cost_month_usd), 0);
  const shadowTotal = totMrr + totUsage;
  const marginPct = shadowTotal > 0 ? ((shadowTotal - totCost) / shadowTotal) * 100 : null;

  const tiles: KpiTileProps[] = [
    { label: 'Shadow MRR (contracted)', value: usd(totMrr), size: 'sm', status: 'grey',
      footnote: 'SIMULATED — draft contracts, not billed · v_commercial_exec' },
    { label: 'Shadow usage · this month', value: usd(totUsage), size: 'sm', status: 'grey',
      footnote: 'rated_usage gross, replay rows excluded' },
    { label: 'Net billable (after credits)', value: usd(totNet), size: 'sm', status: 'grey',
      footnote: 'unbilled state — export gated until client #1 (ADR-197)' },
    { label: 'Measured cost · this month', value: usd(totCost), size: 'sm', status: 'green',
      footnote: 'costs.cost_events (real, immutable)' },
    { label: 'Blended shadow margin', value: marginPct == null ? '—' : `${marginPct.toFixed(1)}%`, size: 'sm',
      status: marginPct == null ? 'grey' : marginPct < 60 ? 'red' : 'green',
      footnote: 'floor 0.6 (workbook governance) · assurance-enforced' },
    { label: 'Open assurance exceptions', value: String(assurance.length), size: 'sm',
      status: assurance.length > 0 ? 'red' : 'green',
      footnote: 'fn_revenue_assurance_run · daily 01:20 UTC' },
  ];

  const execRows = exec.map((r) => {
    const shadow = Number(r.shadow_mrr_usd) + Number(r.shadow_usage_month_usd);
    const cost = Number(r.cost_month_usd);
    return {
      tenant: r.tenant,
      mrr: usd(r.shadow_mrr_usd),
      usage: usd(r.shadow_usage_month_usd),
      net: usd(r.net_billable_month_usd),
      cost: usd(cost),
      margin: shadow > 0 ? `${(((shadow - cost) / shadow) * 100).toFixed(1)}%` : '—',
    };
  });
  const execCols: ChartSeries[] = [
    { key: 'mrr', label: 'Shadow MRR' }, { key: 'usage', label: 'Shadow usage (mo)' },
    { key: 'net', label: 'Net billable' }, { key: 'cost', label: 'Measured cost' },
    { key: 'margin', label: 'Shadow margin' },
  ];

  const catRows = catalog.filter((c) => c.charge_type != null).map((c) => ({
    key: `${c.product_code} · ${c.charge_type} · ${c.price_model}`,
    product: `${c.product_code} v${c.version}`,
    kind: c.product_kind,
    charge: c.charge_type ?? '—',
    model: c.price_model ?? '—',
    meter: c.meter_code ?? '—',
    price: c.price_model === 'cost_plus'
      ? `cost + ${Number(c.markup_percent ?? 0) * 100}%`
      : c.unit_amount == null ? 'tiered' : `${usd(c.unit_amount)}${c.billing_interval && c.billing_interval !== 'none' ? ` / ${c.billing_interval}` : ''}`,
    included: c.included_quantity == null || Number(c.included_quantity) === 0 ? '—' : String(c.included_quantity),
    state: c.version_status,
  }));
  const catCols: ChartSeries[] = [
    { key: 'product', label: 'Product' }, { key: 'kind', label: 'Kind' },
    { key: 'charge', label: 'Charge type' }, { key: 'model', label: 'Price model' },
    { key: 'meter', label: 'Meter' }, { key: 'price', label: 'Price' },
    { key: 'included', label: 'Included' }, { key: 'state', label: 'State' },
  ];

  const entMap = new Map<string, string[]>();
  for (const e of planEnts) {
    const list = entMap.get(e.product_code) ?? [];
    list.push(`${e.entitlement_code}=${JSON.stringify(e.entitlement_value)}`);
    entMap.set(e.product_code, list);
  }
  const entRows = Array.from(entMap.entries()).map(([product, list]) => ({
    product, entitlements: list.join(' · '),
  }));
  const entCols: ChartSeries[] = [{ key: 'entitlements', label: 'Bundle (plan_entitlements)' }];

  const conRows = contracts.map((c) => ({
    key: `${c.contract_number} · ${c.product_code ?? '—'}`,
    tenant: c.tenant, contract: c.contract_number, status: c.status,
    component: c.product_code ?? '—',
    book: c.price_book ?? '—',
    discount: c.discount_percent && Number(c.discount_percent) > 0 ? `${Number(c.discount_percent) * 100}%` : '—',
  }));
  const conCols: ChartSeries[] = [
    { key: 'tenant', label: 'Tenant' }, { key: 'contract', label: 'Contract' },
    { key: 'status', label: 'Status' }, { key: 'component', label: 'Component' },
    { key: 'book', label: 'Price book' }, { key: 'discount', label: 'Discount' },
  ];

  const ratedRows = rated.map((r) => ({
    key: `${r.tenant_slug}·${r.meter_code}·${r.occurred_at}`,
    when: r.occurred_at.slice(0, 10),
    tenant: r.tenant_slug, meter: r.meter_code,
    qty: String(r.quantity),
    method: r.calculation_trace?.tier_calc?.method ?? '—',
    source: r.calculation_trace?.resolution?.source ?? '—',
    gross: usd(r.gross_amount), credit: usd(r.credit_amount), net: usd(r.net_billable_amount),
  }));
  const ratedCols: ChartSeries[] = [
    { key: 'when', label: 'Date' }, { key: 'tenant', label: 'Tenant' },
    { key: 'meter', label: 'Meter' }, { key: 'qty', label: 'Qty' },
    { key: 'method', label: 'Model' }, { key: 'source', label: 'Price source' },
    { key: 'gross', label: 'Gross (shadow)' }, { key: 'credit', label: 'Credits' },
    { key: 'net', label: 'Net billable' },
  ];

  const walletRows = wallets.map((w) => ({
    tenant: w.tenant_slug, currency: w.currency,
    granted: usd(w.credits_granted), consumed: usd(w.credits_consumed), balance: usd(w.balance),
  }));
  const walletCols: ChartSeries[] = [
    { key: 'currency', label: 'CCY' }, { key: 'granted', label: 'Granted' },
    { key: 'consumed', label: 'Consumed' }, { key: 'balance', label: 'Balance' },
  ];

  const assurRows = assurance.map((a) => ({
    key: `${a.check_code}·${a.detected_at}`,
    check: a.check_code.replace(/_/g, ' '),
    tenant: a.tenant_slug ?? 'platform',
    entity: a.entity_type ?? '—',
    detected: a.detected_at.slice(0, 16).split('T').join(' '),
  }));
  const assurCols: ChartSeries[] = [
    { key: 'check', label: 'Check' }, { key: 'tenant', label: 'Tenant' },
    { key: 'entity', label: 'Entity' }, { key: 'detected', label: 'Detected (UTC)' },
  ];

  const capexRows = capex.map((c) => ({
    key: c.project_code,
    project: `${c.project_code} — ${c.name}`,
    status: c.status,
    linked: usd(c.linked_cost_usd),
    assessments: String(c.assessments),
    asset: c.asset_code ?? 'not capitalized',
    carrying: c.carrying_amount == null ? '—' : usd(c.carrying_amount),
  }));
  const capexCols: ChartSeries[] = [
    { key: 'status', label: 'Status' }, { key: 'linked', label: 'Linked cost' },
    { key: 'assessments', label: 'Assessments' }, { key: 'asset', label: 'Asset' },
    { key: 'carrying', label: 'Carrying amount' },
  ];

  const freePlanRows = catalog.filter((c) => c.product_code === 'PLAN-FREE' && c.charge_type != null).length;

  return (
    <DashboardPage
      title="Commercial — the platform operating system"
      subtitle="Monetization Engine v2 · composable business models: membership + usage + hybrid · every number is SHADOW-rated (no bare revenue, MD §2.15) · external billing execution gated until client #1 (ADR-197)"
    >
      <Container title="Executive monetization" subtitle="v_commercial_exec · shadow MRR + rated usage vs measured cost — the three-ledger law reconciles here" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Business Model Designer" subtitle="compose plan = base fee + entitlements + metered components · assign to a tenant · zero deploy (fn_commercial_plan_upsert / fn_commercial_assign_plan)">
        <CommercialActions meters={meters} />
      </Container>

      <Container title="Customer economics" subtitle="per tenant: contracted + usage vs cost-to-serve · Namkhan + Donna run as internal tenants on draft plans">
        <Chart variant="table" data={execRows} xKey="tenant" series={execCols}
          empty={{ title: 'No tenants wired', hint: 'seed migration missing' }} />
      </Container>

      <Container title="Catalogue + price book (draft v1)" subtitle="PB-STD-V1 · workbook seeds PLAN-FREE/START/PRO/ENT + modules + usage products · all 8 price models, all 7 charge types · PBS-editable rows, zero hardcoding">
        <Chart variant="table" data={catRows} xKey="key" series={catCols}
          empty={{ title: 'Catalogue empty', hint: 'monetization_v2_seeds_bridges migration missing' }} />
      </Container>

      <Container title="Plan entitlement bundles" subtitle="plan_entitlements — versioned bundles, never app enums · runtime-checked BEFORE execution via fn_entitlement_check">
        <Chart variant="table" data={entRows} xKey="product" series={entCols}
          empty={{ title: 'No bundles' }} />
      </Container>

      <Container title="Contracts + subscriptions" subtitle="customer_contracts + contract_components · price resolution: contract override → partner/segment book → regional book → list (MD §5.2)">
        <Chart variant="table" data={conRows} xKey="key" series={conCols}
          empty={{ title: 'No contracts' }} />
      </Container>

      <Container title="Rated usage (shadow) — latest 50" subtitle="usage_events (immutable, idempotent) → rating engine → rated_usage with calculation_trace · replay-verified reproducible">
        <Chart variant="table" data={ratedRows} xKey="key" series={ratedCols}
          empty={{ title: 'No rated usage yet', hint: 'fn_usage_ingest + fn_rate_pending' }} />
      </Container>

      <Container title="Credit wallets" subtitle="credit_ledger — all credit kinds, expiry, consumption priority · applied in rating before net billable">
        <Chart variant="table" data={walletRows} xKey="tenant" series={walletCols}
          empty={{ title: 'No wallets' }} />
      </Container>

      <Container
        title="Free-plan economics"
        subtitle={`PLAN-FREE seeded with ${freePlanRows} price component(s) · $10/tenant/month shadow-cost ceiling enforced by assurance · no free tenants yet — cohort tiles activate with the first free signup (zero-from-no-data stays honest, not green)`}
      >
        <Chart variant="table" data={[]} xKey="cohort" series={[
          { key: 'active', label: 'Active free tenants' }, { key: 'cost', label: 'Shadow cost' },
          { key: 'conversion', label: 'Conversion' }, { key: 'action', label: 'Action' },
        ]} empty={{ title: 'No free-plan tenants yet', hint: 'assign PLAN-FREE to a tenant in the Designer above to activate this dashboard' }} />
      </Container>

      <Container title="Revenue assurance" subtitle="MD §5.10 loop · unrated usage, leakage, expired discounts, minimums, margin floor 0.6, free ceiling $10, unbilled <1% · daily cron 01:20 UTC">
        <Chart variant="table" data={assurRows} xKey="key" series={assurCols}
          empty={{ title: '0 open exceptions', hint: 'all assurance checks passing' }} />
      </Container>

      <Container title="Platform build investment (CAPEX)" subtitle="capital_projects fed from costs.build_labor_log + platform_build cost events · accounting policy DRAFT-PENDING-ACCOUNTANT (MD §9.2 — PBS + accountant sign-off required before amortization posts)">
        <Chart variant="table" data={capexRows} xKey="key" series={capexCols}
          empty={{ title: 'No capital projects', hint: 'costs.build_labor_log is empty — capex feed activates when labor logging starts' }} />
      </Container>
    </DashboardPage>
  );
}
