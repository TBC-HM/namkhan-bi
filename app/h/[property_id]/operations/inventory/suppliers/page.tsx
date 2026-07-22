// app/h/[property_id]/operations/inventory/suppliers/page.tsx
//
// Vendor register — LIVE via gl.v_supplier_overview (QuickBooks feed, 173 rows).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getGlVendorOverview, getGlSupplierKpis } from '@/app/operations/inventory/_data';
import SuppliersList, { type SupplierRow } from './SuppliersList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number | null): string => n == null ? 'N/A' : `${n.toFixed(1)}%`;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default async function SuppliersPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/suppliers`);
  }

  const [raw, kpis] = await Promise.all([
    getGlVendorOverview(),
    getGlSupplierKpis(),
  ]);

  const rows: SupplierRow[] = raw.map((r) => ({
    vendor_name: r.vendor_name,
    line_count: fmtInt(r.line_count),
    last_txn_date: fmtDate(r.last_txn_date),
    gross_spend_usd: fmtUsd(r.gross_spend_usd),
    distinct_accounts: fmtInt(r.distinct_accounts),
    is_active_recent: r.is_active_recent ? 'YES' : '—',
  }));

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Vendor register · 2026" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Vendors on file',     value: fmtInt(kpis.vendor_count),          footnote: 'Distinct vendors in gl.v_supplier_overview' },
            { label: 'Active recent',       value: fmtInt(kpis.active_recent_count),   footnote: 'Vendor with txn in last 90 days' },
            { label: 'YTD spend',           value: fmtUsd(kpis.ytd_gross_spend_usd),   footnote: 'Sum of gross_spend_usd YTD' },
            { label: 'MTD spend',           value: fmtUsd(kpis.current_month_gross_spend_usd), footnote: 'From gl.v_top_suppliers_current_month' },
            { label: 'Top-1 share',         value: fmtPct(kpis.top_vendor_share_pct),
              footnote: kpis.top_vendor_name ? `Top YTD: ${kpis.top_vendor_name}` : undefined },
            { label: 'Account anomalies',   value: fmtInt(kpis.anomaly_count),         footnote: 'Rows in gl.v_supplier_account_anomalies' },
          ]}
        />
      </div>

      {rows.length === 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="No vendors on file" expandable={false}>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
              gl.v_supplier_overview returned no rows. Check the QuickBooks sync.
            </div>
          </Container>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <SuppliersList title="Vendors" data={rows} />
        </div>
      )}
    </DashboardPage>
  );
}
