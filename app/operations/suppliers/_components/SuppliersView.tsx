// app/operations/suppliers/_components/SuppliersView.tsx
// Shared body for the Suppliers page. Mounted from /operations/suppliers
// (OPERATIONS_SUBPAGES) and /finance/suppliers (FINANCE_SUBPAGES) — the two
// thin page.tsx wrappers thread their own strip via subPages prop, so the
// chrome matches whichever surface the user arrived from.
//
// Rebuild from legacy Page + Panel + KpiBox to the new primitives:
//   DashboardPage + MetricRow (6 KpiTiles) + Container around SuppliersTable.
// SuppliersTable client component is unchanged — it already does its own
// sortable rendering; we just give it a clean Container shell.

import { DashboardPage, Container, MetricRow, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { FX_LAK_PER_USD, fmtMoney } from '@/lib/format';
import SuppliersTable, { type SupplierRow } from './SuppliersTable';

interface Props {
  subPages: { label: string; href: string }[];
  /** Which entry in subPages is the current page — match by href suffix. */
  activeHrefSuffix: string;
  /** Eyebrow line context (e.g. "Operations" or "Finance"). */
  surfaceLabel: string;
  /** Base path for supplier detail links (so /finance rows route to /finance/[name]). */
  linkBase?: string;
}

interface OverviewRow {
  vendor_name: string;
  line_count: number | null;
  active_periods: number | null;
  first_txn_date: string | null;
  last_txn_date: string | null;
  gross_spend_usd: number | string | null;
  net_amount_usd: number | string | null;
  distinct_accounts: number | null;
  distinct_classes: number | null;
  currency_guess: string | null;
  is_active_recent: boolean | null;
}

interface VendorMeta {
  vendor_name: string;
  category: string | null;
  terms: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean | null;
}

interface UnpaidAgg {
  supplier: string;
  open_lak: number;
  open_count: number;
}

async function getSupplierOverview(): Promise<OverviewRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('gl')
    .from('v_supplier_overview')
    .select('vendor_name,line_count,active_periods,first_txn_date,last_txn_date,gross_spend_usd,net_amount_usd,distinct_accounts,distinct_classes,currency_guess,is_active_recent')
    .order('gross_spend_usd', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) { console.error('getSupplierOverview error', error); return []; }
  return (data ?? []) as OverviewRow[];
}

async function getVendorMeta(): Promise<Map<string, VendorMeta>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('gl')
    .from('vendors')
    .select('vendor_name,category,terms,email,phone,is_active')
    .limit(1000);
  if (error) { console.error('getVendorMeta error', error); return new Map(); }
  const m = new Map<string, VendorMeta>();
  for (const r of (data ?? []) as VendorMeta[]) m.set(r.vendor_name, r);
  return m;
}

async function getUnpaidAgg(): Promise<Map<string, UnpaidAgg>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('messy')
    .from('unpaid_bills')
    .select('supplier,balance_lak,human_status')
    .limit(2000);
  if (error) { console.error('getUnpaidAgg error', error); return new Map(); }
  const m = new Map<string, UnpaidAgg>();
  for (const r of (data ?? []) as { supplier: string; balance_lak: number | string | null; human_status: string | null }[]) {
    const status = r.human_status ?? 'open';
    if (status === 'reconciled' || status === 'paid_off_book') continue;
    const cur = m.get(r.supplier) ?? { supplier: r.supplier, open_lak: 0, open_count: 0 };
    cur.open_lak += Number(r.balance_lak ?? 0);
    cur.open_count += 1;
    m.set(r.supplier, cur);
  }
  return m;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export default async function SuppliersView({ subPages, activeHrefSuffix, surfaceLabel, linkBase }: Props) {
  const [overview, vendorMap, unpaidMap] = await Promise.all([
    getSupplierOverview(),
    getVendorMeta(),
    getUnpaidAgg(),
  ]);

  const rows: SupplierRow[] = overview.map((o) => {
    const meta = vendorMap.get(o.vendor_name);
    const unpaid = unpaidMap.get(o.vendor_name);
    const lastDays = daysSince(o.last_txn_date);
    return {
      name: o.vendor_name,
      category: meta?.category ?? null,
      terms: meta?.terms ?? null,
      email: meta?.email ?? null,
      currency: o.currency_guess ?? null,
      grossUsd: Number(o.gross_spend_usd ?? 0),
      lineCount: Number(o.line_count ?? 0),
      lastTxnDate: o.last_txn_date,
      lastDays,
      activeRecent: !!o.is_active_recent,
      openBalanceLak: unpaid?.open_lak ?? 0,
      openBalanceUsd: unpaid ? unpaid.open_lak / FX_LAK_PER_USD : 0,
      openBillCount: unpaid?.open_count ?? 0,
    };
  });

  const total = rows.length;
  const active90 = rows.filter((r) => r.lastDays != null && r.lastDays <= 90).length;
  const totalOpenLak = rows.reduce((s, r) => s + r.openBalanceLak, 0);
  const totalOpenUsd = totalOpenLak / FX_LAK_PER_USD;
  const since90Iso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const top90 = rows
    .filter((r) => r.lastTxnDate && r.lastTxnDate >= since90Iso)
    .sort((a, b) => b.grossUsd - a.grossUsd)[0];
  const totalSpendShown = rows.reduce((s, r) => s + r.grossUsd, 0);

  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith(activeHrefSuffix),
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total suppliers',     value: total,                                   unit: 'count',   footnote: 'Distinct vendors in gl.v_supplier_overview' },
    { label: 'Active · 90d',         value: active90,                                unit: 'count',   footnote: 'At least one QB transaction in last 90 days' },
    { label: 'Total spend · all-time', value: fmtMoney(totalSpendShown, 'USD'),       footnote: 'Sum of gross_spend_usd across all suppliers' },
    { label: 'Open AP · supplier debt', value: fmtMoney(totalOpenUsd, 'USD'),         footnote: `₭${totalOpenLak.toLocaleString('en-US')} · FX ${FX_LAK_PER_USD.toLocaleString('en-US')}`, status: totalOpenUsd > 0 ? 'amber' : 'grey' },
    { label: 'Top spend · 90d',      value: top90 ? fmtMoney(top90.grossUsd, 'USD') : '—', footnote: top90 ? `${top90.name} · ${top90.lineCount} lines` : 'No 90-day activity' },
    { label: 'Suppliers with debt',  value: unpaidMap.size,                          unit: 'count',   footnote: 'Distinct suppliers with at least one unreconciled bill', status: unpaidMap.size > 0 ? 'amber' : 'grey' },
  ];

  return (
    <DashboardPage
      title={`${surfaceLabel} · Suppliers`}
      subtitle={`Supplier register · ${total} vendors · source gl.v_supplier_overview joined with gl.vendors + messy.unpaid_bills`}
      tabs={tabs.length ? tabs : undefined}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={tiles} size="md" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Supplier register"
          subtitle="gl.v_supplier_overview · join gl.vendors · join messy.unpaid_bills · click a row → supplier detail"
          density="compact"
        >
          <SuppliersTable rows={rows} linkBase={linkBase} />
        </Container>
      </div>
    </DashboardPage>
  );
}
