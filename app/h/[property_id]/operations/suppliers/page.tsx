// app/h/[property_id]/operations/suppliers/page.tsx
// Donna canonical Suppliers landing — placeholder until vendor master + AP feed.

import { redirect } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSuppliersPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/suppliers');

  return (
    <Page
      eyebrow={`Operations · Suppliers · property_id=${propertyId}`}
      title={<>Suppliers · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <Panel title="Suppliers · coming soon" eyebrow="empty" expandable={false}>
        <div style={{ padding: 20, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)' }}>
          Suppliers surface for Donna is queued. The Namkhan reference at <code>/operations/suppliers</code> renders a vendor overview with AP aging, USALI breakdown per supplier, recent transactions, and a per-supplier detail page. Once Donna&rsquo;s gestor&iacute;a AP feed is normalised into <code>gl.vendors</code> / <code>gl.v_supplier_overview</code>, this page renders the same canonical layout plus a right-side detail drawer.
        </div>
      </Panel>
    </Page>
  );
}
