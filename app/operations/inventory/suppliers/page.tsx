// app/operations/inventory/suppliers/page.tsx
//
// Suppliers register — LIVE WIRED to QuickBooks via gl.* schema.
// Data: gl.v_supplier_overview (joined to gl.vendors for category/email/phone/terms)
//       + gl.v_top_suppliers_ytd / current_month + gl.v_supplier_account_anomalies.
//
// Replaces the previous version that read from suppliers.* (8 seeded rows).
// suppliers.* schema retained for future curated procurement records.

import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import { getGlVendorOverview, getGlSupplierKpis } from '../_data';
import GlVendorsTableClient from './_GlVendorsTableClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function SuppliersListPage() {
  const [rows, kpis] = await Promise.all([
    getGlVendorOverview(),
    getGlSupplierKpis(),
  ]);

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Suppliers"
        title={<>Vendor <em style={{ color: 'var(--brass)' }}>register · 2026</em></>}
        lede={<>Derived from QB transaction lines · {rows.length} vendors with activity since 2026-01-01 · {kpis.active_recent_count} active in last 90d. Names are raw QB Name field — clean later. Click a row for full transaction history.</>}
      />

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={kpis.vendor_count} unit="count" label="Vendors on file" tooltip="Distinct vendors in gl.v_supplier_overview" />
        <KpiBox value={kpis.active_recent_count} unit="count" label="Active recent" tooltip="Vendors with a transaction in the last 90 days (is_active_recent flag)" />
        <KpiBox value={kpis.ytd_gross_spend_usd} unit="usd" label="YTD spend" tooltip="Sum of gross_spend_usd across all vendors" />
        <KpiBox value={kpis.current_month_gross_spend_usd} unit="usd" label="MTD spend" tooltip="From gl.v_top_suppliers_current_month" />
        <KpiBox value={kpis.top_vendor_share_pct} unit="pct" label="Top-1 share" dp={1}
          tooltip={kpis.top_vendor_name ? `Top vendor YTD: ${kpis.top_vendor_name}` : undefined} />
        <KpiBox value={kpis.anomaly_count} unit="count" label="Account anomalies" tooltip="Rows in gl.v_supplier_account_anomalies (vendor × account combinations flagged for review)" />
      </div>

      <div style={{ marginTop: 22 }}>
        <GlVendorsTableClient rows={rows} />
      </div>

      <div style={{
        marginTop: 18,
        padding: '12px 14px',
        background: 'var(--paper-deep, #f6f3ec)',
        borderLeft: '2px solid var(--brass)',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          fontSize: 'var(--t-xs)',
          marginBottom: 6,
        }}>Data lineage · 2026 YTD</div>
        Source: <code style={{ fontFamily: 'var(--mono)' }}>gl.gl_entries.customer_name</code> (raw QB transaction Name field) WHERE <code style={{ fontFamily: 'var(--mono)' }}>qb_txn_type IN ('Bill', 'Bill Payment (Cheque)', 'Cheque', 'Expense', 'Vendor Credit', 'Refund')</code>, surfaced via <code style={{ fontFamily: 'var(--mono)' }}>gl.v_supplier_overview</code>, filtered to <code style={{ fontFamily: 'var(--mono)' }}>last_txn_date &gt;= 2026-01-01</code>. No join to <code style={{ fontFamily: 'var(--mono)' }}>gl.vendors</code> (that master is empty — 0 emails, 0 categories, 0 terms). Curated supplier attributes (reliability, contacts, alternates, lead time) will live in <code style={{ fontFamily: 'var(--mono)' }}>suppliers.*</code> when the procurement workflow ships (Phase 2.5b).
      </div>
    </>
  );
}
