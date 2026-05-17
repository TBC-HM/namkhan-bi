// app/h/[property_id]/operations/spa/page.tsx
// Donna canonical Spa landing — placeholder until spa booking data is wired.
// Namkhan is redirected to its rich legacy page at /operations/spa.

import { redirect } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSpaPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/spa');

  return (
    <Page
      eyebrow={`Operations · Spa · property_id=${propertyId}`}
      title={<>Spa · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <Panel title="Spa · coming soon" eyebrow="empty" expandable={false}>
        <div style={{ padding: 20, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)' }}>
          Spa operations surface for Donna is queued. When the booking data feed
          is wired (treatment-mix, occupancy, ADR, therapist utilisation), this
          page will render the canonical layout matching <code>/operations/spa</code> on Namkhan.
        </div>
      </Panel>
    </Page>
  );
}
