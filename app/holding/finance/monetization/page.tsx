// app/holding/finance/monetization/page.tsx
// Monetization Engine v1 — HOLDING platform-commerce dashboard
// (brief monetization-engine-v1 · naming law: "Monetization", never "Revenue" —
//  that name belongs to the hotel revenue-management module).
//
// Phase-1 surface: catalogue · entitlements · shadow-price margins · ADR-169 locks.
// Client billing portal / contracts / invoices are client-#1-gated — NOT here.
//
// Every figure traces to a view (metric truth law — zero hand-typed numbers):
//   catalogue            → public.v_commercial_products      (commercial.products + versions)
//   entitlement matrix   → public.v_commercial_entitlements  (tenancy.property_modules + overrides via fn_entitlement_check)
//   shadow-price margins → public.v_commercial_margin_monthly (costs.cost_events × commercial.shadow_prices)
//   shadow price book    → public.v_commercial_shadow_prices
//   governance locks     → public.v_commercial_margin_rules  (ADR-169: <60% kill floor · 80% target · 3× client gate)
//
// Revenue-state discipline: everything on this page is SHADOW (simulated) —
// no amount is labelled revenue without state; shadow rows are marked placeholder
// until a real pricing decision (ADR-169: number derived from data, not guessed).

import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ProductRow {
  product_code: string; name: string; description: string | null;
  product_kind: string; owner_module_code: string | null; module_tier: string | null;
  saleable: boolean; active: boolean; version: number | null; version_status: string | null;
}
interface EntitlementRow {
  tenant_name: string; is_internal: boolean; property_id: number; property_name: string;
  module_code: string; module_name: string; module_tier: string; status: string;
  entitled: boolean; entitlement_source: string;
}
interface MarginRow {
  month: string; module_key: string; property_id: number | null; events: number;
  cost_usd: number; shadow_revenue_usd: number | null; shadow_margin_usd: number | null;
  shadow_margin_pct: number | null; below_kill_floor: boolean | null;
  price_is_placeholder: boolean | null; price_basis: string | null;
}
interface PriceRow {
  module_key: string; capability: string | null; basis: string;
  unit_amount_usd: number | null; markup_percent: number | null;
  effective_from: string; is_placeholder: boolean; active: boolean;
}
interface RuleRow {
  rule_code: string; description: string; threshold_value: number;
  unit: string; comparator: string; source: string; active: boolean;
}

const PROPERTY_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };
const usd = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 })}`;
const tenantLabel = (pid: number | null): string =>
  pid == null ? 'Platform' : PROPERTY_LABEL[pid] ?? String(pid);

export default async function HoldingMonetizationPage() {
  const sb = getSupabaseAdmin();
  const [prodRes, entRes, marginRes, priceRes, ruleRes] = await Promise.all([
    sb.from('v_commercial_products').select('*').order('product_kind').order('product_code'),
    sb.from('v_commercial_entitlements').select('*').order('property_id').order('module_code'),
    sb.from('v_commercial_margin_monthly').select('*').order('month', { ascending: false }),
    sb.from('v_commercial_shadow_prices').select('*').order('module_key'),
    sb.from('v_commercial_margin_rules').select('*').order('rule_code'),
  ]);
  if (prodRes.error) throw new Error(`v_commercial_products: ${prodRes.error.message}`);

  const products = (prodRes.data ?? []) as ProductRow[];
  const entitlements = (entRes.data ?? []) as EntitlementRow[];
  const margins = (marginRes.data ?? []) as MarginRow[];
  const prices = (priceRes.data ?? []) as PriceRow[];
  const rules = (ruleRes.data ?? []) as RuleRow[];

  const months = Array.from(new Set(margins.map((m) => m.month))).sort();
  const curMonth = months[months.length - 1] ?? null;
  const cur = margins.filter((m) => m.month === curMonth);
  const curCost = cur.reduce((s, m) => s + Number(m.cost_usd), 0);
  const curShadow = cur.reduce((s, m) => s + Number(m.shadow_revenue_usd ?? 0), 0);
  const curMarginPct = curShadow > 0 ? ((curShadow - curCost) / curShadow) * 100 : null;
  const killBreaches = cur.filter((m) => m.below_kill_floor === true).length;
  const entitledActive = entitlements.filter((e) => e.entitled).length;
  const allPlaceholder = prices.length > 0 && prices.every((p) => p.is_placeholder);

  const killFloor = rules.find((r) => r.rule_code === 'kill_floor_margin_pct')?.threshold_value ?? 60;

  const tiles: KpiTileProps[] = [
    { label: 'Catalogue products', value: String(products.length), size: 'sm', status: 'green',
      footnote: 'public.v_commercial_products · seeded from tenancy.modules' },
    { label: 'Active entitlements', value: String(entitledActive), size: 'sm',
      status: entitledActive > 0 ? 'green' : 'amber',
      footnote: 'property × module · fn_entitlement_check' },
    { label: `Shadow revenue · ${curMonth?.slice(0, 7) ?? '—'}`, value: usd(curShadow), size: 'sm',
      status: 'grey', footnote: 'SIMULATED — placeholder prices, not billed' },
    { label: `Shadow margin · ${curMonth?.slice(0, 7) ?? '—'}`,
      value: curMarginPct == null ? '—' : `${curMarginPct.toFixed(1)}%`, size: 'sm',
      status: curMarginPct == null ? 'grey' : curMarginPct < killFloor ? 'red' : curMarginPct >= 80 ? 'green' : 'amber',
      footnote: `vs measured cost ${usd(curCost)} (costs.cost_events)` },
    { label: 'Kill-floor breaches', value: String(killBreaches), size: 'sm',
      status: killBreaches > 0 ? 'red' : 'green',
      footnote: `ADR-169: margin < ${killFloor}% per tenant-module` },
  ];

  const productRows = products.map((p) => ({
    code: p.product_code, name: p.name, kind: p.product_kind,
    tier: p.module_tier ?? (p.product_kind === 'plan' ? 'bundle' : '—'),
    version: p.version == null ? '—' : `v${p.version} (${p.version_status ?? '—'})`,
    saleable: p.saleable ? 'yes' : 'no',
  }));
  const productCols: ChartSeries[] = [
    { key: 'name', label: 'Name' }, { key: 'kind', label: 'Kind' },
    { key: 'tier', label: 'Tier' }, { key: 'version', label: 'Version' },
    { key: 'saleable', label: 'Saleable' },
  ];

  const entRows = entitlements.map((e) => ({
    property: `${e.property_name}${e.is_internal ? '' : ' (external)'}`,
    module: e.module_name, tier: e.module_tier, status: e.status,
    entitled: e.entitled ? 'yes' : 'NO',
    source: e.entitlement_source.replace(/_/g, ' '),
  }));
  const entCols: ChartSeries[] = [
    { key: 'module', label: 'Module' }, { key: 'tier', label: 'Tier' },
    { key: 'status', label: 'Status' }, { key: 'entitled', label: 'Entitled' },
    { key: 'source', label: 'Decision source' },
  ];

  const trendData = months.map((m) => {
    const rows = margins.filter((r) => r.month === m);
    return {
      month: m.slice(0, 7),
      cost: Math.round(rows.reduce((s, r) => s + Number(r.cost_usd), 0) * 100) / 100,
      shadow_revenue: Math.round(rows.reduce((s, r) => s + Number(r.shadow_revenue_usd ?? 0), 0) * 100) / 100,
    };
  });

  const marginRows = margins.slice(0, 30).map((m) => ({
    key: `${m.month.slice(0, 7)} · ${tenantLabel(m.property_id)} · ${m.module_key}`,
    month: m.month.slice(0, 7),
    tenant: tenantLabel(m.property_id),
    module: m.module_key.replace(/_/g, ' '),
    cost: usd(m.cost_usd), shadow: usd(m.shadow_revenue_usd),
    margin: m.shadow_margin_pct == null ? '—' : `${m.shadow_margin_pct}%${m.below_kill_floor ? ' ⚠ below floor' : ''}`,
    basis: `${m.price_basis ?? 'unpriced'}${m.price_is_placeholder ? ' (placeholder)' : ''}`,
  }));
  const marginCols: ChartSeries[] = [
    { key: 'month', label: 'Month' }, { key: 'tenant', label: 'Tenant' },
    { key: 'module', label: 'Module' }, { key: 'cost', label: 'Measured cost' },
    { key: 'shadow', label: 'Shadow revenue' }, { key: 'margin', label: 'Shadow margin' },
    { key: 'basis', label: 'Price basis' },
  ];

  const priceRows = prices.map((p) => ({
    module: p.module_key.replace(/_/g, ' '),
    basis: p.basis.replace(/_/g, ' '),
    price: p.basis === 'cost_plus'
      ? `cost + ${p.markup_percent ?? 0}%`
      : `${usd(p.unit_amount_usd)}${p.basis === 'per_month_flat' ? ' / mo' : ' / event'}`,
    from: p.effective_from,
    state: p.is_placeholder ? 'PLACEHOLDER' : 'decided',
  }));
  const priceCols: ChartSeries[] = [
    { key: 'basis', label: 'Basis' }, { key: 'price', label: 'Shadow price' },
    { key: 'from', label: 'Effective' }, { key: 'state', label: 'State' },
  ];

  const ruleRows = rules.map((r) => ({
    rule: r.rule_code.replace(/_/g, ' '),
    threshold: `${r.comparator === 'lt' ? '< ' : r.comparator === 'gte' ? '≥ ' : ''}${r.threshold_value}${r.unit === 'percent' ? '%' : r.unit === 'multiple_of_cost_to_serve' ? '× cost-to-serve' : ''}`,
    description: r.description, source: r.source,
  }));
  const ruleCols: ChartSeries[] = [
    { key: 'threshold', label: 'Lock' }, { key: 'description', label: 'Description' },
    { key: 'source', label: 'Source' },
  ];

  return (
    <DashboardPage
      title="Finance · Monetization — platform commerce"
      subtitle="Monetization Engine v1 · catalogue + entitlements + shadow pricing · three-ledger law: cost explains consumption, monetization explains what the customer bought — they reconcile, never merge"
    >
      <Container
        title="Monetization headline"
        subtitle={allPlaceholder
          ? 'ALL shadow prices are placeholders — margins are simulations feeding the deferred pricing decision (ADR-169), not billed amounts'
          : curMonth ? `month of ${curMonth.slice(0, 7)}` : 'no rated usage yet'}
        density="compact"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Product catalogue" subtitle="commercial.products · versioned rows seeded from tenancy.modules · plans = bundles, not enums">
        <Chart variant="table" data={productRows} xKey="code" series={productCols}
          empty={{ title: 'Catalogue empty', hint: 'seed migration missing' }} />
      </Container>

      <Container title="Entitlements — who runs what" subtitle="tenancy.property_modules + commercial.entitlement_overrides · checked BEFORE task execution via public.fn_entitlement_check">
        <Chart variant="table" data={entRows} xKey="property" series={entCols}
          empty={{ title: 'No entitlements', hint: 'tenancy.property_modules is empty' }} />
      </Container>

      <Container title="Measured cost vs shadow revenue" subtitle="costs.cost_events (immutable metering) × commercial.shadow_prices (effective-dated, versioned)">
        <Chart
          variant="stacked_bar"
          data={trendData}
          xKey="month"
          series={[{ key: 'cost', label: 'measured cost' }, { key: 'shadow_revenue', label: 'shadow revenue (simulated)' }]}
          height={240}
          formatY={(v) => `$${v}`}
          empty={{ title: 'No rated usage yet', hint: 'costs-ingest populates costs.cost_events hourly' }}
        />
      </Container>

      <Container title="Shadow margin by tenant · module · month" subtitle="public.v_commercial_margin_monthly · unit-economics math live with zero invoices · ⚠ flags = ADR-169 kill floor">
        <Chart variant="table" data={marginRows} xKey="key" series={marginCols}
          empty={{ title: 'No margin rows', hint: 'needs cost events + an active shadow price' }} />
      </Container>

      <Container title="Shadow price book" subtitle="commercial.shadow_prices · placeholder candidate prices until the pricing decision is derived from measured cost-to-serve (ADR-169)">
        <Chart variant="table" data={priceRows} xKey="module" series={priceCols}
          empty={{ title: 'No shadow prices' }} />
      </Container>

      <Container title="Margin governance — deal-desk locks" subtitle="commercial.margin_rules · ADR-169 PBS-locked 2026-07-25 · enforceable thresholds, not guidance">
        <Chart variant="table" data={ruleRows} xKey="rule" series={ruleCols}
          empty={{ title: 'No rules seeded' }} />
      </Container>
    </DashboardPage>
  );
}
