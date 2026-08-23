import { redirect } from 'next/navigation';
import DashboardPage from '@/app/(cockpit)/_design/layout/DashboardPage';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSuppliersPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/suppliers');

  return (
    <DashboardPage title="Suppliers">
      <div style={{ padding: 20, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, gridColumn: '1 / -1' }}>
        <p style={{ marginTop: 0 }}>
          Suppliers surface for Donna is queued. The Namkhan reference at{' '}
          <code>/operations/suppliers</code> renders a vendor overview with AP aging, USALI
          breakdown per supplier, recent transactions, and a per-supplier detail page.
        </p>
        <p style={{ color: 'var(--ink-mute)', marginBottom: 0 }}>
          Once Donna’s gestoría AP feed is normalised into <code>gl.vendors</code>{' '}
          /{' '}<code>gl.v_supplier_overview</code>, this page renders the same canonical layout
          plus a right-side detail drawer.
        </p>
      </div>
    </DashboardPage>
  );
}
