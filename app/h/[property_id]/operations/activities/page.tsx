// app/h/[property_id]/operations/activities/page.tsx
// Donna canonical Activities landing — placeholder until activity bookings
// feed is wired. Namkhan redirects to its rich legacy /operations/activities.

import { redirect } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaActivitiesPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/activities');

  return (
    <Page
      eyebrow={`Operations · Activities · property_id=${propertyId}`}
      title={<>Activities · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <Panel title="Activities · coming soon" eyebrow="empty" expandable={false}>
        <div style={{ padding: 20, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)' }}>
          Activities surface for Donna is queued. When the bookings feed (sailing, excursions, transfers, marina services) is wired, this page renders the
          canonical layout from <code>/operations/activities</code>.
        </div>
      </Panel>
    </Page>
  );
}
