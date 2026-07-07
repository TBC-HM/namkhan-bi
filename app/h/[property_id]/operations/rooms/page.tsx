// app/h/[property_id]/operations/rooms/page.tsx
// PBS 2026-07-08: Donna Rooms operations landing.
// Uses DashboardPage (not the legacy <Page>) so the operations sub-strip
// AND the department sub-strip (Rooms · F&B · Spa · Activities · Retail ·
// Transport · Other) both render from NAV_SUBGROUPS. Namkhan (260955) is
// redirected to its rich /operations/rooms canonical page.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRoomsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/rooms');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · Rooms" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Rooms · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/rooms`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            Rooms operations surface for Donna Portals is queued. When Cloudbeds
            folio + housekeeping feeds are wired, this page renders the same
            layout as the Namkhan canonical view (occupancy, ADR, RevPAR, ALOS,
            room-type mix, P&amp;L). Use the sub-tabs above to open F&amp;B,
            Spa, Activities, Retail, Transport, or Other.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
