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
        title={<>Vendor <em style={{ color: 'var(--brass)' }}>register</em></>}
        lede={<>Live from QuickBooks GL · {rows.length} vendors · {kpis.active_recent_count} active in last 90d. Click a row for full transaction history.</>}
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
        }}>Data source</div>
        Live from <code style={{ fontFamily: 'var(--mono)' }}>gl.v_supplier_overview</code> + <code style={{ fontFamily: 'var(--mono)' }}>gl.vendors</code>. Refreshes when QB upload runs (see <code style={{ fontFamily: 'var(--mono)' }}>gl.qb_import_staging</code>). For curated procurement records (reliability scores, contacts, alternates), use the <code style={{ fontFamily: 'var(--mono)' }}>suppliers.*</code> schema — currently empty, to be populated via Phase 2.5b workflow.
      </div>
    </>
  );
}
