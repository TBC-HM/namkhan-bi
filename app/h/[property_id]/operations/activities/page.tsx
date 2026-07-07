// app/h/[property_id]/operations/activities/page.tsx
// PBS 2026-07-08: swapped from legacy <Page> to DashboardPage so both the
// operations top strip AND the department sub-strip render from NAV_SUBGROUPS.
// Namkhan (260955) redirects to its /operations/activities page.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaActivitiesPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/activities');

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'Departments',
  }));

  return (
    <DashboardPage title="Operations · Activities" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Activities · awaiting Donna feed" subtitle={`property_id=${propertyId} · Namkhan reference: /operations/activities`}>
          <div style={{ padding: 20, color: '#5A5A5A', fontSize: 13, maxWidth: 720 }}>
            Activities surface for Donna Portals is queued. When the bookings
            feed (sailing, excursions, transfers, marina services) is wired,
            this page renders the canonical layout from
            <code> /operations/activities</code>.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
