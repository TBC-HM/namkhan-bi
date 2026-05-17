// app/h/[property_id]/operations/restaurant/page.tsx
// Donna canonical F&B landing — placeholder until F&B data feed is wired.
// Namkhan is redirected to its rich legacy page at /operations/restaurant.
//
// PBS 2026-05-15: "Replicate the full F&B / SPA / Activities pages in Donna,
// full canonical, no data yet, but set up in full." This stub gives Donna a
// theme-correct surface + canonical operations subpages strip so the nav
// never 404s while we wait for the data feed.

import { redirect } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRestaurantPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (propertyId === NAMKHAN_PROPERTY_ID) redirect('/operations/restaurant');

  return (
    <Page
      eyebrow={`Operations · F&B · property_id=${propertyId}`}
      title={<>F&amp;B · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>not yet wired</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >
      <Panel title="F&B · coming soon" eyebrow="empty" expandable={false}>
        <div style={{ padding: 20, color: 'var(--tbl-fg-mute, rgba(26, 26, 26, 0.6))', fontSize: 'var(--t-sm)' }}>
          The F&amp;B operations surface for Donna Portals is queued. The Namkhan
          F&amp;B page (legacy <code>/operations/restaurant</code>) is the reference
          structure; once Donna&rsquo;s POS feed lands, this page will render the
          same canonical layout (KPIs, covers, ADR-equivalent, cost % trends).
        </div>
      </Panel>
    </Page>
  );
}
