// app/h/[property_id]/operations/inventory/page.tsx
// Donna canonical Inventory landing — placeholder. Namkhan redirects to legacy.

import { redirect } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaInventoryPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/inventory');

  return (
    <Page
      eyebrow={`Operations · Inventory · property_id=${propertyId}`}
      title={<>Inventory · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <Panel title="Inventory · coming soon" eyebrow="empty" expandable={false}>
        <div style={{ padding: 20, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)' }}>
          Inventory surface for Donna is queued. The Namkhan reference at <code>/operations/inventory</code> has 11 sub-tabs (catalog · stock · par · counts · orders · requests · items · suppliers · capex · assets · shop) — those will land canonically under <code>/h/{propertyId}/operations/inventory/*</code> once the master-data feed is wired. A right-side product drawer (same pattern as the staff drawer) is also queued.
        </div>
      </Panel>
    </Page>
  );
}
