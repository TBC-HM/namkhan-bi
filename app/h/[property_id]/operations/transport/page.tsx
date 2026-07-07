// app/h/[property_id]/operations/transport/page.tsx
// PBS 2026-07-08: NEW concrete Donna transport page (previously served by
// the [...rest] catchall which uses <Page>, so the dept sub-strip was
// missing). DashboardPage picks up NAV_SUBGROUPS so both strips render.
// Namkhan (260955) redirects to /operations/transport.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaTransportPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/transport');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · Transport" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Transport · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/transport`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            Transport operations surface for Donna Portals is queued. When
            the transport feed lands (airport pickups, transfers, boat
            charters), this page renders the canonical layout matching
            Namkhan&apos;s /operations/transport.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
