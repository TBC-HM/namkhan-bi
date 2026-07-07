// app/h/[property_id]/operations/restaurant/page.tsx
// PBS 2026-07-08: swapped from legacy <Page> to DashboardPage so both the
// operations top strip AND the department sub-strip (Rooms · F&B · Spa ·
// Activities · Retail · Transport · Other) render from NAV_SUBGROUPS.
// Namkhan (260955) redirects to its rich /operations/restaurant page.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRestaurantPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/restaurant');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · F&B" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="F&B · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/restaurant`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            F&amp;B operations surface for Donna Portals is queued. Once the
            POS feed lands, this page will render the same canonical layout
            as Namkhan (KPIs, covers, ADR-equivalent, cost % trends).
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
