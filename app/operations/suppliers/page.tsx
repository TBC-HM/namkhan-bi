// app/operations/suppliers/page.tsx
//
// Operations · Suppliers — list page (channels-pattern mirror).
// PBS 2026-05-09: "There used to be a Supplier tab in the Operations area;
// if you don't find we must make a new one similar concept like channels just
// suppliers". Original page read from suppliers.suppliers (0 rows). Rewritten
// to read the canonical QB-derived registry: gl.v_supplier_overview (135 rows)
// joined with gl.vendors (terms / email / category) + messy.unpaid_bills
// (open AP balance, exact name match where it lines up).
//
// Channels-pattern mirrored: <Page> shell + KPI strip + sortable supplier
// table + each row links to /operations/suppliers/[supplier]. Sub-page strip
// via OPERATIONS_SUBPAGES.
//
// Source eyebrow on the panel honours the PBS rule: "if ops.suppliers doesn't
// exist and ap.suppliers is your best bet, surface that openly".

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { FX_LAK_PER_USD, fmtMoney } from '@/lib/format';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import SuppliersTable, { type SupplierRow } from './_components/SuppliersTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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
  if (error) {
    console.error('getSupplierOverview error', error);
    return [];
  }
  return (data ?? []) as OverviewRow[];
}

async function getVendorMeta(): Promise<Map<string, VendorMeta>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('gl')
    .from('vendors')
    .select('vendor_name,category,terms,email,phone,is_active')
    .limit(1000);
  if (error) {
    console.error('getVendorMeta error', error);
    return new Map();
  }
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
  if (error) {
    console.error('getUnpaidAgg error', error);
    return new Map();
  }
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

export default async function SuppliersPage() {
  const [overview, vendorMap, unpaidMap] = await Promise.all([
    getSupplierOverview(),
    getVendorMeta(),
    getUnpaidAgg(),
  ]);

  // Build sortable rows. last_active_days = days since last QB transaction.
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

  // KPI aggregates
  const total = rows.length;
  const active90 = rows.filter((r) => r.lastDays != null && r.lastDays <= 90).length;
  const totalOpenLak = rows.reduce((s, r) => s + r.openBalanceLak, 0);
  const totalOpenUsd = totalOpenLak / FX_LAK_PER_USD;

  // Top 90d spend
  const since90Iso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const top90 = rows
    .filter((r) => r.lastTxnDate && r.lastTxnDate >= since90Iso)
    .sort((a, b) => b.grossUsd - a.grossUsd)[0];

  const totalSpendShown = rows.reduce((s, r) => s + r.grossUsd, 0);

  return (
    <Page
      eyebrow={`Operations · Suppliers · gl.v_supplier_overview · ${total} rows`}
      title={<>Supplier <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>register</em>.</>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox
          value={total}
          unit="count"
          label="Total suppliers"
          tooltip="Distinct vendors in gl.v_supplier_overview (QuickBooks-derived). Source: gl.v_supplier_overview."
        />
        <KpiBox
          value={active90}
          unit="count"
          label="Active · 90d"
          tooltip="Suppliers with at least one QB transaction in the last 90 days. Source: gl.v_supplier_overview.last_txn_date."
        />
        <KpiBox
          value={totalSpendShown}
          unit="usd"
          label="Total spend · all-time"
          tooltip="Sum of gross_spend_usd across all suppliers. Source: gl.v_supplier_overview."
        />
        <KpiBox
          value={totalOpenUsd}
          unit="usd"
          label="Open AP · supplier debt"
          tooltip={`Sum of unreconciled bill balances. ₭${totalOpenLak.toLocaleString('en-US')} converted at FX ${FX_LAK_PER_USD.toLocaleString('en-US')}. Source: messy.unpaid_bills.balance_lak.`}
        />
        <KpiBox
          value={top90 ? top90.grossUsd : null}
          unit="usd"
          label="Top spend · 90d"
          valueText={top90 ? <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)' }}>{fmtMoney(top90.grossUsd, 'USD')}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', textTransform: 'none', letterSpacing: 0 }}>{top90.name}</span>
          </span> : '—'}
          tooltip={top90 ? `${top90.name} · ${top90.lineCount} lines in last-90d activity. Source: gl.v_supplier_overview.` : 'No suppliers with QB activity in last 90 days.'}
        />
        <KpiBox
          value={unpaidMap.size}
          unit="count"
          label="Suppliers with debt"
          tooltip="Distinct suppliers with at least one unreconciled bill. Source: messy.unpaid_bills."
        />
      </div>

      <Panel
        title="Supplier register"
        eyebrow="gl.v_supplier_overview · join gl.vendors · join messy.unpaid_bills"
        actions={<ArtifactActions context={{ kind: 'table', title: 'Supplier register', dept: 'operations' }} />}
      >
        <SuppliersTable rows={rows} />
      </Panel>
    </Page>
  );
}
