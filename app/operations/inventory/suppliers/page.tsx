// app/operations/inventory/suppliers/page.tsx
//
// Suppliers register — list view.
// Source: suppliers.v_supplier_summary + suppliers.v_local_sourcing_pct.

import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import UploadSuppliersButton from '../_components/UploadSuppliersButton';
import { getSupplierSummaries, getLocalSourcing } from '../_data';
import SuppliersTableClient from './_SuppliersTableClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function SuppliersListPage() {
  const [rows, local] = await Promise.all([
    getSupplierSummaries(),
    getLocalSourcing(),
  ]);

  // KPIs
  const active = rows.filter((r) => r.status === 'active').length;
  const itemsCovered = rows.reduce((s, r) => s + r.items_supplied, 0);
  const leadTimes = rows.map((r) => r.lead_time_days).filter((v): v is number => v != null);
  const avgLead = leadTimes.length === 0 ? null : leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length;
  const reliability = rows.map((r) => r.reliability_score).filter((v): v is number => v != null);
  const avgRel = reliability.length === 0
    ? null
    : (reliability.reduce((s, n) => s + n, 0) / reliability.length) * (reliability[0] != null && reliability[0] <= 1 ? 100 : 1);
  const noContact = rows.filter((r) => r.contact_count === 0).length;

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Suppliers"
        title={<>Supplier <em style={{ color: 'var(--brass)' }}>register</em></>}
        lede="Vendors, contacts, lead times, and local-sourcing share. Click a row for full detail."
        rightSlot={<UploadSuppliersButton />}
      />

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={active} unit="count" label="Active suppliers" tooltip={`${rows.length} on file in total`} />
        <KpiBox value={local.local_supplier_pct} unit="pct" label="Local sourcing" dp={0}
          tooltip={`${local.local_supplier_count} of ${local.total_supplier_count} flagged is_local_sourcing`} />
        <KpiBox value={itemsCovered} unit="count" label="Items covered" tooltip="Sum of items_supplied across all suppliers (primary + alternate)" />
        <KpiBox value={avgLead} unit="d" label="Avg lead time" dp={0} tooltip={`Mean across ${leadTimes.length} suppliers with lead_time_days set`}
          state={avgLead == null ? 'data-needed' : 'live'} needs={avgLead == null ? 'lead_time_days field' : undefined} />
        <KpiBox value={avgRel} unit="pct" label="Avg reliability" dp={0} tooltip={`Mean reliability_score across ${reliability.length} suppliers`}
          state={avgRel == null ? 'data-needed' : 'live'} needs={avgRel == null ? 'reliability scoring' : undefined} />
        <KpiBox value={noContact} unit="count" label="Missing contact" tooltip="Suppliers with zero rows in suppliers.contacts" />
      </div>

      <div style={{ marginTop: 22 }}>
        <SuppliersTableClient rows={rows} />
      </div>
    </>
  );
}
